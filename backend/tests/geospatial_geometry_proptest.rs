//! Property-based tests for the pure geometry helpers in
//! `services::geospatial` (issue #1481). No I/O or service state is involved.

use proptest::prelude::*;
use scavenger_backend::services::geospatial::{Coordinates, GeoService};

/// Half the circumference of the Earth in metres: the largest possible
/// great-circle distance between two points.
const MAX_DISTANCE_M: f64 = std::f64::consts::PI * 6_371_000.0;
const TOLERANCE_M: f64 = 1e-3;

fn valid_coords() -> impl Strategy<Value = Coordinates> {
    (-90.0f64..=90.0, -180.0f64..=180.0).prop_map(|(lat, lon)| Coordinates { lat, lon })
}

proptest! {
    #[test]
    fn haversine_is_symmetric(a in valid_coords(), b in valid_coords()) {
        let ab = GeoService::haversine_distance(&a, &b);
        let ba = GeoService::haversine_distance(&b, &a);
        prop_assert!((ab - ba).abs() <= TOLERANCE_M);
    }

    #[test]
    fn haversine_of_identical_points_is_zero(a in valid_coords()) {
        let d = GeoService::haversine_distance(&a, &a);
        prop_assert!(d.abs() <= TOLERANCE_M);
    }

    #[test]
    fn haversine_is_non_negative_and_bounded(a in valid_coords(), b in valid_coords()) {
        let d = GeoService::haversine_distance(&a, &b);
        prop_assert!(d.is_finite());
        prop_assert!(d >= 0.0);
        prop_assert!(d <= MAX_DISTANCE_M + TOLERANCE_M);
    }

    #[test]
    fn haversine_satisfies_triangle_inequality(
        a in valid_coords(),
        b in valid_coords(),
        c in valid_coords(),
    ) {
        let ac = GeoService::haversine_distance(&a, &c);
        let ab = GeoService::haversine_distance(&a, &b);
        let bc = GeoService::haversine_distance(&b, &c);
        prop_assert!(ac <= ab + bc + TOLERANCE_M);
    }

    #[test]
    fn coordinates_accept_every_point_in_range(lat in -90.0f64..=90.0, lon in -180.0f64..=180.0) {
        let coords = Coordinates::new(lat, lon);
        prop_assert!(coords.is_ok());
        let coords = coords.unwrap_or_else(|e| panic!("in-range point rejected: {e}"));
        prop_assert_eq!(coords.lat, lat);
        prop_assert_eq!(coords.lon, lon);
    }

    #[test]
    fn coordinates_reject_latitude_outside_range(lat in prop_oneof![90.000001f64..1e6, -1e6f64..-90.000001], lon in -180.0f64..=180.0) {
        prop_assert!(Coordinates::new(lat, lon).is_err());
    }

    #[test]
    fn coordinates_reject_longitude_outside_range(lat in -90.0f64..=90.0, lon in prop_oneof![180.000001f64..1e6, -1e6f64..-180.000001]) {
        prop_assert!(Coordinates::new(lat, lon).is_err());
    }
}
