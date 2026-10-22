/// #804 - Geospatial Query Service
/// Distance queries, proximity search, spatial indexes, and route optimisation.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use thiserror::Error;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Mean Earth radius in metres (WGS-84 approximation)
const EARTH_RADIUS_M: f64 = 6_371_000.0;

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, Error, Clone)]
pub enum GeoError {
    #[error("Invalid coordinates: lat={lat}, lon={lon}")]
    InvalidCoordinates { lat: f64, lon: f64 },
    #[error("Location not found: {0}")]
    NotFound(String),
    #[error("Invalid radius: {0} m")]
    InvalidRadius(f64),
}

// ── Core types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Coordinates {
    pub lat: f64,
    pub lon: f64,
}

impl Coordinates {
    pub fn new(lat: f64, lon: f64) -> Result<Self, GeoError> {
        if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
            return Err(GeoError::InvalidCoordinates { lat, lon });
        }
        Ok(Self { lat, lon })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub id: String,
    pub name: String,
    pub coordinates: Coordinates,
    pub tags: HashMap<String, String>,
}

// ── Query/result types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityQuery {
    pub center: Coordinates,
    /// Search radius in metres
    pub radius_m: f64,
    /// Optional tag filter, e.g. {"type": "recycler"}
    pub filter_tags: HashMap<String, String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityResult {
    pub location: GeoLocation,
    /// Straight-line distance from query centre in metres
    pub distance_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistanceQuery {
    pub from: Coordinates,
    pub to: Coordinates,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistanceResult {
    pub distance_m: f64,
    pub distance_km: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteRequest {
    pub waypoints: Vec<Coordinates>,
    pub optimize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteResult {
    pub ordered_waypoints: Vec<Coordinates>,
    pub total_distance_m: f64,
    pub segments: Vec<f64>,
}

// ── Spatial index (grid-based bucket index for O(1) amortised lookup) ─────────

struct GridIndex {
    /// Cell size in degrees (≈ 11 km for 0.1°)
    cell_size: f64,
    buckets: HashMap<(i32, i32), Vec<String>>,
}

impl GridIndex {
    fn new(cell_size: f64) -> Self {
        Self {
            cell_size,
            buckets: HashMap::new(),
        }
    }

    fn cell(&self, lat: f64, lon: f64) -> (i32, i32) {
        (
            (lat / self.cell_size).floor() as i32,
            (lon / self.cell_size).floor() as i32,
        )
    }

    fn insert(&mut self, id: &str, lat: f64, lon: f64) {
        let key = self.cell(lat, lon);
        self.buckets.entry(key).or_default().push(id.to_string());
    }

    fn remove(&mut self, id: &str, lat: f64, lon: f64) {
        let key = self.cell(lat, lon);
        if let Some(bucket) = self.buckets.get_mut(&key) {
            bucket.retain(|x| x != id);
        }
    }

    /// Candidate IDs in cells that overlap a bounding box derived from radius_m.
    fn candidates_in_radius(&self, lat: f64, lon: f64, radius_m: f64) -> Vec<String> {
        // Approximate degrees of latitude/longitude spanning radius_m
        let delta_lat = radius_m / EARTH_RADIUS_M * (180.0 / std::f64::consts::PI);
        let delta_lon = delta_lat / lat.to_radians().cos().abs().max(1e-9);

        let min_cell = self.cell(lat - delta_lat, lon - delta_lon);
        let max_cell = self.cell(lat + delta_lat, lon + delta_lon);

        let mut ids = Vec::new();
        for row in min_cell.0..=max_cell.0 {
            for col in min_cell.1..=max_cell.1 {
                if let Some(bucket) = self.buckets.get(&(row, col)) {
                    ids.extend_from_slice(bucket);
                }
            }
        }
        ids
    }
}

// ── #1158: Extracted filter helper ───────────────────────────────────────────

/// #1158: extracted from proximity_search()
/// Returns true when all required tag key/value pairs are present on the location.
/// An empty `filter_tags` map always returns true (no filter applied).
fn passes_tag_filter(location: &GeoLocation, filter_tags: &HashMap<String, String>) -> bool {
    filter_tags
        .iter()
        .all(|(k, v)| location.tags.get(k).map_or(false, |val| val == v))
}

// ── Geospatial service ────────────────────────────────────────────────────────

pub struct GeoService {
    locations: Mutex<HashMap<String, GeoLocation>>,
    index: Mutex<GridIndex>,
}

impl GeoService {
    pub fn new() -> Self {
        Self {
            locations: Mutex::new(HashMap::new()),
            index: Mutex::new(GridIndex::new(0.1)), // 0.1° ≈ 11 km cells
        }
    }

    // ── Index management ───────────────────────────────────────────────────

    pub fn add_location(&self, loc: GeoLocation) -> Result<(), GeoError> {
        let lat = loc.coordinates.lat;
        let lon = loc.coordinates.lon;
        self.index.lock().unwrap().insert(&loc.id, lat, lon);
        self.locations.lock().unwrap().insert(loc.id.clone(), loc);
        Ok(())
    }

    pub fn remove_location(&self, id: &str) -> Result<(), GeoError> {
        let mut locs = self.locations.lock().unwrap();
        let loc = locs.remove(id).ok_or_else(|| GeoError::NotFound(id.to_string()))?;
        self.index
            .lock()
            .unwrap()
            .remove(id, loc.coordinates.lat, loc.coordinates.lon);
        Ok(())
    }

    pub fn get_location(&self, id: &str) -> Option<GeoLocation> {
        self.locations.lock().unwrap().get(id).cloned()
    }

    // ── Distance calculation (Haversine) ───────────────────────────────────

    pub fn haversine_distance(from: &Coordinates, to: &Coordinates) -> f64 {
        let lat1 = from.lat.to_radians();
        let lat2 = to.lat.to_radians();
        let dlat = (to.lat - from.lat).to_radians();
        let dlon = (to.lon - from.lon).to_radians();

        let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        EARTH_RADIUS_M * c
    }

    pub fn calculate_distance(&self, q: DistanceQuery) -> DistanceResult {
        let d = Self::haversine_distance(&q.from, &q.to);
        DistanceResult {
            distance_m: d,
            distance_km: d / 1000.0,
        }
    }

    // ── Proximity search ───────────────────────────────────────────────────

    pub fn proximity_search(&self, q: ProximityQuery) -> Result<Vec<ProximityResult>, GeoError> {
        if q.radius_m <= 0.0 {
            return Err(GeoError::InvalidRadius(q.radius_m));
        }

        let candidate_ids = self
            .index
            .lock()
            .unwrap()
            .candidates_in_radius(q.center.lat, q.center.lon, q.radius_m);

        let locs = self.locations.lock().unwrap();
        let limit = q.limit.unwrap_or(usize::MAX);

        let mut results: Vec<ProximityResult> = candidate_ids
            .iter()
            .filter_map(|id| locs.get(id.as_str()))
            .filter(|loc| passes_tag_filter(loc, &q.filter_tags))
            .filter_map(|loc| {
                let d = Self::haversine_distance(&q.center, &loc.coordinates);
                if d <= q.radius_m {
                    Some(ProximityResult {
                        location: loc.clone(),
                        distance_m: d,
                    })
                } else {
                    None
                }
            })
            .collect();

        results.sort_by(|a, b| a.distance_m.partial_cmp(&b.distance_m).unwrap());
        results.truncate(limit);
        Ok(results)
    }

    // ── Nearest N ─────────────────────────────────────────────────────────

    pub fn nearest(&self, center: &Coordinates, n: usize) -> Vec<ProximityResult> {
        let locs = self.locations.lock().unwrap();
        let mut results: Vec<ProximityResult> = locs
            .values()
            .map(|loc| {
                let d = Self::haversine_distance(center, &loc.coordinates);
                ProximityResult {
                    location: loc.clone(),
                    distance_m: d,
                }
            })
            .collect();
        results.sort_by(|a, b| a.distance_m.partial_cmp(&b.distance_m).unwrap());
        results.truncate(n);
        results
    }

    // ── Route optimisation (nearest-neighbour greedy TSP) ──────────────────

    pub fn optimise_route(&self, req: RouteRequest) -> Result<RouteResult, GeoError> {
        let mut waypoints = req.waypoints;
        if waypoints.len() < 2 {
            let total = 0.0;
            return Ok(RouteResult {
                ordered_waypoints: waypoints,
                total_distance_m: total,
                segments: vec![],
            });
        }

        if !req.optimize {
            // Return as-is with segment distances
            let mut total = 0.0;
            let mut segments = Vec::new();
            for pair in waypoints.windows(2) {
                let d = Self::haversine_distance(&pair[0], &pair[1]);
                segments.push(d);
                total += d;
            }
            return Ok(RouteResult {
                ordered_waypoints: waypoints,
                total_distance_m: total,
                segments,
            });
        }

        // Greedy nearest-neighbour starting from waypoints[0]
        let mut remaining: Vec<Coordinates> = waypoints.drain(1..).collect();
        let mut ordered = vec![waypoints.remove(0)];
        let mut segments = Vec::new();
        let mut total = 0.0;

        while !remaining.is_empty() {
            let last = ordered.last().unwrap();
            let (idx, dist) = remaining
                .iter()
                .enumerate()
                .map(|(i, c)| (i, Self::haversine_distance(last, c)))
                .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
                .unwrap();
            segments.push(dist);
            total += dist;
            ordered.push(remaining.remove(idx));
        }

        Ok(RouteResult {
            ordered_waypoints: ordered,
            total_distance_m: total,
            segments,
        })
    }
}

impl Default for GeoService {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/// # Coordinate system assumptions
///
/// * Latitude:  –90 (South Pole) to +90 (North Pole), inclusive.
/// * Longitude: –180 (antimeridian, west) to +180 (antimeridian, east), inclusive.
/// * Distances are computed with the Haversine formula using the WGS-84 mean
///   Earth radius (6 371 000 m).  Results are accurate to within ~0.5% for
///   typical surface distances; the formula is less accurate for very short
///   distances (< 1 m) due to floating-point precision limits.
/// * The grid index uses 0.1° cells (~11 km).  Very large radii may produce
///   false-positive candidate sets, but the exact Haversine filter removes
///   them before results are returned.
#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn london() -> Coordinates {
        Coordinates::new(51.5074, -0.1278).unwrap()
    }
    fn paris() -> Coordinates {
        Coordinates::new(48.8566, 2.3522).unwrap()
    }
    fn berlin() -> Coordinates {
        Coordinates::new(52.5200, 13.4050).unwrap()
    }

    fn make_loc(id: &str, lat: f64, lon: f64) -> GeoLocation {
        GeoLocation {
            id: id.to_string(),
            name: id.to_string(),
            coordinates: Coordinates::new(lat, lon).unwrap(),
            tags: HashMap::new(),
        }
    }

    fn make_tagged_loc(id: &str, lat: f64, lon: f64, key: &str, val: &str) -> GeoLocation {
        let mut loc = make_loc(id, lat, lon);
        loc.tags.insert(key.to_string(), val.to_string());
        loc
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Original tests (preserved)
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_invalid_coordinates() {
        assert!(Coordinates::new(91.0, 0.0).is_err());
        assert!(Coordinates::new(0.0, 181.0).is_err());
        assert!(Coordinates::new(-90.0, -180.0).is_ok());
    }

    #[test]
    fn test_haversine_london_paris() {
        let d = GeoService::haversine_distance(&london(), &paris());
        // Real distance ≈ 341 km; allow ±10 km
        assert!((d - 341_000.0).abs() < 10_000.0, "d={}", d);
    }

    #[test]
    fn test_calculate_distance() {
        let svc = GeoService::new();
        let r = svc.calculate_distance(DistanceQuery {
            from: london(),
            to: paris(),
        });
        assert!(r.distance_km > 330.0 && r.distance_km < 350.0);
    }

    #[test]
    fn test_proximity_search_finds_nearby() {
        let svc = GeoService::new();
        svc.add_location(make_loc("near", 51.51, -0.12)).unwrap();
        svc.add_location(make_loc("far", 48.85, 2.35)).unwrap();

        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 5000.0,
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].location.id, "near");
    }

    #[test]
    fn test_proximity_search_with_tag_filter() {
        let svc = GeoService::new();
        let mut recycler = make_loc("recycler", 51.51, -0.12);
        recycler.tags.insert("type".to_string(), "recycler".to_string());
        let mut collector = make_loc("collector", 51.515, -0.13);
        collector.tags.insert("type".to_string(), "collector".to_string());
        svc.add_location(recycler).unwrap();
        svc.add_location(collector).unwrap();

        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());

        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 10_000.0,
                filter_tags: filter,
                limit: None,
            })
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].location.id, "recycler");
    }

    #[test]
    fn test_invalid_radius() {
        let svc = GeoService::new();
        let err = svc.proximity_search(ProximityQuery {
            center: london(),
            radius_m: -1.0,
            filter_tags: HashMap::new(),
            limit: None,
        });
        assert!(matches!(err, Err(GeoError::InvalidRadius(_))));
    }

    #[test]
    fn test_nearest() {
        let svc = GeoService::new();
        svc.add_location(make_loc("london", 51.5074, -0.1278)).unwrap();
        svc.add_location(make_loc("paris", 48.8566, 2.3522)).unwrap();
        svc.add_location(make_loc("berlin", 52.52, 13.405)).unwrap();

        let results = svc.nearest(&paris(), 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].location.id, "paris");
    }

    #[test]
    fn test_route_no_optimise() {
        let svc = GeoService::new();
        let wps = vec![london(), paris(), berlin()];
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: false,
            })
            .unwrap();
        assert_eq!(result.ordered_waypoints.len(), 3);
        assert_eq!(result.segments.len(), 2);
        assert!(result.total_distance_m > 0.0);
    }

    #[test]
    fn test_route_optimise_nearest_neighbour() {
        let svc = GeoService::new();
        let wps = vec![london(), berlin(), paris()];
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: true,
            })
            .unwrap();
        assert_eq!(result.ordered_waypoints.len(), 3);
        assert!(result.total_distance_m > 0.0);
    }

    #[test]
    fn test_remove_location() {
        let svc = GeoService::new();
        svc.add_location(make_loc("a", 51.5, -0.1)).unwrap();
        assert!(svc.get_location("a").is_some());
        svc.remove_location("a").unwrap();
        assert!(svc.get_location("a").is_none());
    }

    #[test]
    fn test_proximity_limit() {
        let svc = GeoService::new();
        for i in 0..5 {
            let lat = 51.5 + i as f64 * 0.001;
            svc.add_location(make_loc(&format!("loc{i}"), lat, -0.12)).unwrap();
        }
        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 50_000.0,
                filter_tags: HashMap::new(),
                limit: Some(3),
            })
            .unwrap();
        assert_eq!(results.len(), 3);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Issue #1126 — New tests
    // ─────────────────────────────────────────────────────────────────────────

    // ── Coordinate boundary validation ───────────────────────────────────────

    #[test]
    fn test_valid_boundary_coordinates() {
        // Exact boundary values must be accepted
        assert!(Coordinates::new(90.0, 0.0).is_ok(),  "lat=90 should be valid");
        assert!(Coordinates::new(-90.0, 0.0).is_ok(), "lat=-90 should be valid");
        assert!(Coordinates::new(0.0, 180.0).is_ok(), "lon=180 should be valid");
        assert!(Coordinates::new(0.0, -180.0).is_ok(),"lon=-180 should be valid");
    }

    #[test]
    fn test_invalid_latitude_above_90() {
        let err = Coordinates::new(90.01, 0.0).unwrap_err();
        assert!(matches!(err, GeoError::InvalidCoordinates { .. }));
    }

    #[test]
    fn test_invalid_latitude_below_minus_90() {
        assert!(Coordinates::new(-90.01, 0.0).is_err());
    }

    #[test]
    fn test_invalid_longitude_above_180() {
        assert!(Coordinates::new(0.0, 180.01).is_err());
    }

    #[test]
    fn test_invalid_longitude_below_minus_180() {
        assert!(Coordinates::new(0.0, -180.01).is_err());
    }

    #[test]
    fn test_nan_latitude_is_invalid() {
        // NaN is not in the range [-90, 90]
        assert!(Coordinates::new(f64::NAN, 0.0).is_err());
    }

    #[test]
    fn test_nan_longitude_is_invalid() {
        assert!(Coordinates::new(0.0, f64::NAN).is_err());
    }

    #[test]
    fn test_error_message_includes_coordinates() {
        let err = Coordinates::new(95.0, 200.0).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("95"), "error should mention lat={}", 95);
        assert!(msg.contains("200"), "error should mention lon={}", 200);
    }

    // ── Zero-distance (same point) ────────────────────────────────────────────

    #[test]
    fn test_haversine_same_point_is_zero() {
        let pt = london();
        let d = GeoService::haversine_distance(&pt, &pt);
        assert!(d.abs() < 1e-6, "same-point distance should be ~0, got {d}");
    }

    #[test]
    fn test_calculate_distance_same_point() {
        let svc = GeoService::new();
        let r = svc.calculate_distance(DistanceQuery {
            from: london(),
            to: london(),
        });
        assert!(r.distance_m.abs() < 1e-6);
        assert!(r.distance_km.abs() < 1e-9);
    }

    #[test]
    fn test_proximity_search_includes_point_at_zero_distance() {
        let svc = GeoService::new();
        // Add a location exactly at the search center
        svc.add_location(make_loc("exact", 51.5074, -0.1278)).unwrap();
        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 1.0, // 1 metre radius
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].distance_m.abs() < 1.0);
    }

    // ── Antimeridian crossing (lon ≈ ±180) ───────────────────────────────────

    /// Two points on opposite sides of the antimeridian (±180° longitude).
    /// Haversine handles the wrap-around correctly because it operates on
    /// angular differences after `to_radians()`.
    #[test]
    fn test_haversine_antimeridian_short_crossing() {
        // Suva, Fiji ≈ (−18.14, 178.44)  — just west of antimeridian
        // Apia, Samoa ≈ (−13.83, −171.77) — just east of antimeridian
        // Great-circle ≈ 1 130 km (allow ±100 km)
        let suva = Coordinates::new(-18.14, 178.44).unwrap();
        let apia = Coordinates::new(-13.83, -171.77).unwrap();
        let d = GeoService::haversine_distance(&suva, &apia);
        assert!(
            (d - 1_130_000.0).abs() < 100_000.0,
            "antimeridian crossing distance={:.0} m",
            d
        );
    }

    #[test]
    fn test_haversine_antimeridian_symmetric() {
        // Point A: lon = +179, Point B: lon = -179 (2° apart across antimeridian)
        // at equator, 1° ≈ 111 km → 2° ≈ 222 km
        let a = Coordinates::new(0.0, 179.0).unwrap();
        let b = Coordinates::new(0.0, -179.0).unwrap();
        let d = GeoService::haversine_distance(&a, &b);
        // Allow ±15 km tolerance
        assert!(
            (d - 222_000.0).abs() < 15_000.0,
            "2° at equator across antimeridian ≈ 222 km, got {:.0} m",
            d
        );
    }

    #[test]
    fn test_haversine_antimeridian_points_at_plus_minus_180() {
        // The antimeridian itself: lon = 180 and lon = -180 are the same meridian.
        let a = Coordinates::new(0.0, 180.0).unwrap();
        let b = Coordinates::new(0.0, -180.0).unwrap();
        let d = GeoService::haversine_distance(&a, &b);
        // Should be effectively zero (both are on the antimeridian at equator)
        assert!(d.abs() < 1.0, "lon=180 and lon=-180 at equator distance={d}");
    }

    // ── Poles ─────────────────────────────────────────────────────────────────

    #[test]
    fn test_haversine_north_pole_to_equator() {
        // North Pole (90, 0) to equator (0, 0) ≈ quarter-circle ≈ 10 007 km
        let pole = Coordinates::new(90.0, 0.0).unwrap();
        let equator = Coordinates::new(0.0, 0.0).unwrap();
        let d = GeoService::haversine_distance(&pole, &equator);
        assert!(
            (d - 10_007_000.0).abs() < 50_000.0,
            "pole-to-equator={:.0} m",
            d
        );
    }

    #[test]
    fn test_haversine_south_pole_to_equator() {
        let pole = Coordinates::new(-90.0, 0.0).unwrap();
        let equator = Coordinates::new(0.0, 0.0).unwrap();
        let d = GeoService::haversine_distance(&pole, &equator);
        assert!(
            (d - 10_007_000.0).abs() < 50_000.0,
            "south-pole-to-equator={:.0} m",
            d
        );
    }

    #[test]
    fn test_haversine_pole_to_pole() {
        // North Pole to South Pole ≈ half-circumference ≈ 20 015 km
        let north = Coordinates::new(90.0, 0.0).unwrap();
        let south = Coordinates::new(-90.0, 0.0).unwrap();
        let d = GeoService::haversine_distance(&north, &south);
        assert!(
            (d - 20_015_000.0).abs() < 100_000.0,
            "pole-to-pole={:.0} m",
            d
        );
    }

    #[test]
    fn test_pole_coordinates_valid_any_longitude() {
        // At the poles longitude is meaningless but must be in [-180, 180]
        assert!(Coordinates::new(90.0, 0.0).is_ok());
        assert!(Coordinates::new(90.0, 180.0).is_ok());
        assert!(Coordinates::new(90.0, -180.0).is_ok());
        assert!(Coordinates::new(-90.0, 90.0).is_ok());
    }

    #[test]
    fn test_proximity_search_near_south_pole() {
        // Add a location very close to the South Pole
        let svc = GeoService::new();
        svc.add_location(make_loc("pole-station", -89.9, 0.0)).unwrap();
        svc.add_location(make_loc("tropics", -23.5, 0.0)).unwrap();

        let center = Coordinates::new(-89.99, 0.0).unwrap();
        let results = svc
            .proximity_search(ProximityQuery {
                center,
                radius_m: 20_000.0, // 20 km
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].location.id, "pole-station");
    }

    // ── Distance formula symmetry ─────────────────────────────────────────────

    #[test]
    fn test_haversine_is_symmetric() {
        let d_ab = GeoService::haversine_distance(&london(), &paris());
        let d_ba = GeoService::haversine_distance(&paris(), &london());
        assert!((d_ab - d_ba).abs() < 1e-6, "d(A,B)={d_ab}, d(B,A)={d_ba}");
    }

    #[test]
    fn test_distance_result_m_and_km_consistent() {
        let svc = GeoService::new();
        let r = svc.calculate_distance(DistanceQuery {
            from: london(),
            to: berlin(),
        });
        assert!(
            (r.distance_m / 1000.0 - r.distance_km).abs() < 1e-9,
            "m/1000 ≠ km: {} vs {}",
            r.distance_m,
            r.distance_km
        );
    }

    // ── Proximity search edge cases ───────────────────────────────────────────

    #[test]
    fn test_proximity_search_zero_radius_is_invalid() {
        let svc = GeoService::new();
        let err = svc.proximity_search(ProximityQuery {
            center: london(),
            radius_m: 0.0,
            filter_tags: HashMap::new(),
            limit: None,
        });
        assert!(matches!(err, Err(GeoError::InvalidRadius(_))));
    }

    #[test]
    fn test_proximity_search_empty_service_returns_empty() {
        let svc = GeoService::new();
        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 1_000_000.0,
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_proximity_search_results_sorted_by_distance_ascending() {
        let svc = GeoService::new();
        // Add several locations at increasing distances from London
        svc.add_location(make_loc("close",  51.51, -0.12)).unwrap(); // ~500 m
        svc.add_location(make_loc("medium", 51.55,  0.00)).unwrap(); // ~5 km
        svc.add_location(make_loc("farish", 51.60,  0.10)).unwrap(); // ~12 km

        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 100_000.0,
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();

        for window in results.windows(2) {
            assert!(
                window[0].distance_m <= window[1].distance_m,
                "not sorted: {} > {}",
                window[0].distance_m,
                window[1].distance_m
            );
        }
    }

    #[test]
    fn test_proximity_search_multi_tag_filter_all_must_match() {
        let svc = GeoService::new();

        // loc1 has type=recycler AND material=plastic → should match
        let mut loc1 = make_loc("both", 51.51, -0.12);
        loc1.tags.insert("type".to_string(), "recycler".to_string());
        loc1.tags.insert("material".to_string(), "plastic".to_string());

        // loc2 has only type=recycler → should NOT match
        let loc2 = make_tagged_loc("type-only", 51.52, -0.13, "type", "recycler");

        svc.add_location(loc1).unwrap();
        svc.add_location(loc2).unwrap();

        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        filter.insert("material".to_string(), "plastic".to_string());

        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 50_000.0,
                filter_tags: filter,
                limit: None,
            })
            .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].location.id, "both");
    }

    // ── Remove location edge cases ────────────────────────────────────────────

    #[test]
    fn test_remove_nonexistent_location_returns_not_found() {
        let svc = GeoService::new();
        let err = svc.remove_location("ghost").unwrap_err();
        assert!(matches!(err, GeoError::NotFound(_)));
    }

    #[test]
    fn test_remove_location_disappears_from_proximity_search() {
        let svc = GeoService::new();
        svc.add_location(make_loc("tmp", 51.51, -0.12)).unwrap();
        svc.remove_location("tmp").unwrap();

        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: 100_000.0,
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();
        assert!(results.is_empty());
    }

    // ── nearest() edge cases ─────────────────────────────────────────────────

    #[test]
    fn test_nearest_empty_returns_empty() {
        let svc = GeoService::new();
        let results = svc.nearest(&london(), 5);
        assert!(results.is_empty());
    }

    #[test]
    fn test_nearest_n_larger_than_total_returns_all() {
        let svc = GeoService::new();
        svc.add_location(make_loc("a", 51.5, -0.1)).unwrap();
        svc.add_location(make_loc("b", 52.0,  1.0)).unwrap();
        let results = svc.nearest(&london(), 100);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_nearest_zero_n_returns_empty() {
        let svc = GeoService::new();
        svc.add_location(make_loc("a", 51.5, -0.1)).unwrap();
        let results = svc.nearest(&london(), 0);
        assert!(results.is_empty());
    }

    // ── Route optimisation edge cases ─────────────────────────────────────────

    #[test]
    fn test_route_single_waypoint_returns_it_unchanged() {
        let svc = GeoService::new();
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: vec![london()],
                optimize: true,
            })
            .unwrap();
        assert_eq!(result.ordered_waypoints.len(), 1);
        assert_eq!(result.total_distance_m, 0.0);
        assert!(result.segments.is_empty());
    }

    #[test]
    fn test_route_empty_waypoints() {
        let svc = GeoService::new();
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: vec![],
                optimize: false,
            })
            .unwrap();
        assert!(result.ordered_waypoints.is_empty());
        assert_eq!(result.total_distance_m, 0.0);
    }

    #[test]
    fn test_route_two_waypoints_same_in_both_modes() {
        let svc = GeoService::new();
        let wps = vec![london(), paris()];

        let unopt = svc
            .optimise_route(RouteRequest {
                waypoints: wps.clone(),
                optimize: false,
            })
            .unwrap();

        let opt = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: true,
            })
            .unwrap();

        // With only 2 waypoints there is only one possible order, so distances
        // must match within floating-point tolerance.
        assert!(
            (unopt.total_distance_m - opt.total_distance_m).abs() < 1e-6,
            "unopt={}, opt={}",
            unopt.total_distance_m,
            opt.total_distance_m
        );
    }

    #[test]
    fn test_route_no_optimize_preserves_order() {
        let svc = GeoService::new();
        let wps = vec![london(), paris(), berlin()];
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: false,
            })
            .unwrap();

        let lats: Vec<f64> = result.ordered_waypoints.iter().map(|c| c.lat).collect();
        // Original order: London (51.5), Paris (48.86), Berlin (52.52)
        assert!((lats[0] - 51.5074).abs() < 0.01);
        assert!((lats[1] - 48.8566).abs() < 0.01);
        assert!((lats[2] - 52.5200).abs() < 0.01);
    }

    #[test]
    fn test_route_segments_sum_to_total() {
        let svc = GeoService::new();
        let wps = vec![london(), paris(), berlin()];
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: false,
            })
            .unwrap();

        let sum: f64 = result.segments.iter().sum();
        assert!(
            (sum - result.total_distance_m).abs() < 1e-6,
            "sum of segments {} ≠ total {}",
            sum,
            result.total_distance_m
        );
    }

    // ── Property-based style tests ────────────────────────────────────────────
    //
    // Rust's standard test harness does not include a property-based library
    // (proptest/quickcheck are not in this workspace's Cargo.toml); the
    // following tests encode the same *invariants* that property tests would
    // cover, exercised over a deterministic set of representative inputs that
    // spans the important equivalence classes.

    #[test]
    fn property_haversine_non_negative_for_all_pairs() {
        // d(A, B) ≥ 0 for any valid pair
        let points = [
            Coordinates::new(0.0, 0.0).unwrap(),
            Coordinates::new(90.0, 0.0).unwrap(),
            Coordinates::new(-90.0, 0.0).unwrap(),
            Coordinates::new(0.0, 180.0).unwrap(),
            Coordinates::new(0.0, -180.0).unwrap(),
            Coordinates::new(51.5074, -0.1278).unwrap(),
            Coordinates::new(-33.8688, 151.2093).unwrap(), // Sydney
            Coordinates::new(35.6762, 139.6503).unwrap(),  // Tokyo
        ];

        for a in &points {
            for b in &points {
                let d = GeoService::haversine_distance(a, b);
                assert!(d >= 0.0, "d({:?},{:?})={d}", a.lat, b.lat);
            }
        }
    }

    #[test]
    fn property_haversine_triangle_inequality() {
        // d(A, C) ≤ d(A, B) + d(B, C)  for any A, B, C
        let a = london();
        let b = paris();
        let c = berlin();

        let d_ac = GeoService::haversine_distance(&a, &c);
        let d_ab = GeoService::haversine_distance(&a, &b);
        let d_bc = GeoService::haversine_distance(&b, &c);

        assert!(
            d_ac <= d_ab + d_bc + 1.0, // +1 m tolerance for f64 rounding
            "triangle inequality violated: {d_ac} > {d_ab} + {d_bc}"
        );
    }

    #[test]
    fn property_proximity_search_results_within_radius() {
        let svc = GeoService::new();
        svc.add_location(make_loc("a", 51.51, -0.12)).unwrap();
        svc.add_location(make_loc("b", 51.52, -0.11)).unwrap();
        svc.add_location(make_loc("c", 53.00,  1.00)).unwrap(); // ~200 km

        let radius = 50_000.0_f64;
        let results = svc
            .proximity_search(ProximityQuery {
                center: london(),
                radius_m: radius,
                filter_tags: HashMap::new(),
                limit: None,
            })
            .unwrap();

        // Every returned result must be within the specified radius
        for r in &results {
            assert!(
                r.distance_m <= radius,
                "result {} is {:.0} m > radius {:.0} m",
                r.location.id,
                r.distance_m,
                radius
            );
        }
    }

    #[test]
    fn property_coordinates_constructor_validates_all_boundary_violations() {
        let invalid_cases = [
            (90.001,   0.0),
            (-90.001,  0.0),
            (0.0,    180.001),
            (0.0,   -180.001),
            (91.0,     0.0),
            (0.0,    200.0),
        ];
        for (lat, lon) in invalid_cases {
            assert!(
                Coordinates::new(lat, lon).is_err(),
                "expected error for lat={lat}, lon={lon}"
            );
        }
    }

    // ── #1158: passes_tag_filter unit tests ───────────────────────────────────

    fn loc_with_tags(tags: &[(&str, &str)]) -> GeoLocation {
        GeoLocation {
            id: "test-loc".to_string(),
            name: "Test".to_string(),
            coordinates: Coordinates::new(0.0, 0.0).unwrap(),
            tags: tags.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
        }
    }

    #[test]
    fn test_passes_tag_filter_empty_filter_always_passes() {
        let loc = loc_with_tags(&[]);
        assert!(passes_tag_filter(&loc, &HashMap::new()));
    }

    #[test]
    fn test_passes_tag_filter_matching_tag() {
        let loc = loc_with_tags(&[("type", "recycler")]);
        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        assert!(passes_tag_filter(&loc, &filter));
    }

    #[test]
    fn test_passes_tag_filter_non_matching_value() {
        let loc = loc_with_tags(&[("type", "collector")]);
        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        assert!(!passes_tag_filter(&loc, &filter));
    }

    #[test]
    fn test_passes_tag_filter_missing_key() {
        let loc = loc_with_tags(&[("zone", "a")]);
        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        assert!(!passes_tag_filter(&loc, &filter));
    }

    #[test]
    fn test_passes_tag_filter_multiple_tags_all_match() {
        let loc = loc_with_tags(&[("type", "recycler"), ("region", "eu")]);
        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        filter.insert("region".to_string(), "eu".to_string());
        assert!(passes_tag_filter(&loc, &filter));
    }

    #[test]
    fn test_passes_tag_filter_multiple_tags_one_mismatch() {
        let loc = loc_with_tags(&[("type", "recycler"), ("region", "us")]);
        let mut filter = HashMap::new();
        filter.insert("type".to_string(), "recycler".to_string());
        filter.insert("region".to_string(), "eu".to_string());
        assert!(!passes_tag_filter(&loc, &filter));
    }
}
