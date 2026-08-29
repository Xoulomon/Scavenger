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
            .filter(|loc| {
                q.filter_tags
                    .iter()
                    .all(|(k, v)| loc.tags.get(k).map_or(false, |val| val == v))
            })
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

#[cfg(test)]
mod tests {
    use super::*;

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
        // Add locations near London
        svc.add_location(make_loc("near", 51.51, -0.12)).unwrap(); // ~500 m away
        svc.add_location(make_loc("far", 48.85, 2.35)).unwrap(); // Paris

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
        assert_eq!(results[0].location.id, "paris"); // ~0 m
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
        // Berlin then Paris then London — greedy from London should prefer Paris next
        let wps = vec![london(), berlin(), paris()];
        let result = svc
            .optimise_route(RouteRequest {
                waypoints: wps,
                optimize: true,
            })
            .unwrap();
        assert_eq!(result.ordered_waypoints.len(), 3);
        // London → Paris → Berlin is shorter than London → Berlin → Paris
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
}
