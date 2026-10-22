use scavenger_backend::services::geospatial::*;
use std::collections::HashMap;

#[test]
fn test_coordinates_creation_valid() {
    let coords = Coordinates::new(40.7128, -74.0060).expect("Valid coordinates");
    assert_eq!(coords.lat, 40.7128);
    assert_eq!(coords.lon, -74.0060);
}

#[test]
fn test_coordinates_creation_invalid_latitude_too_high() {
    let result = Coordinates::new(91.0, 0.0);
    assert!(result.is_err());
    if let Err(GeoError::InvalidCoordinates { lat, lon }) = result {
        assert_eq!(lat, 91.0);
        assert_eq!(lon, 0.0);
    }
}

#[test]
fn test_coordinates_creation_invalid_latitude_too_low() {
    let result = Coordinates::new(-91.0, 0.0);
    assert!(result.is_err());
}

#[test]
fn test_coordinates_creation_invalid_longitude_too_high() {
    let result = Coordinates::new(0.0, 181.0);
    assert!(result.is_err());
}

#[test]
fn test_coordinates_creation_invalid_longitude_too_low() {
    let result = Coordinates::new(0.0, -181.0);
    assert!(result.is_err());
}

#[test]
fn test_coordinates_boundary_values() {
    let cases = vec![
        (90.0, 180.0, true),
        (-90.0, -180.0, true),
        (0.0, 0.0, true),
        (45.5, -120.5, true),
        (90.1, 0.0, false),
        (-90.1, 0.0, false),
        (0.0, 180.1, false),
        (0.0, -180.1, false),
    ];

    for (lat, lon, should_succeed) in cases {
        let result = Coordinates::new(lat, lon);
        assert_eq!(result.is_ok(), should_succeed, "Failed for lat={}, lon={}", lat, lon);
    }
}

#[test]
fn test_geo_service_creation() {
    let service = GeoService::new();
    assert!(service.get_location("non-existent").is_none());
}

#[test]
fn test_add_and_retrieve_location() {
    let service = GeoService::new();
    let coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let mut tags = HashMap::new();
    tags.insert("type".to_string(), "recycler".to_string());

    let location = GeoLocation {
        id: "loc1".to_string(),
        name: "NYC Recycler".to_string(),
        coordinates: coords,
        tags,
    };

    service.add_location(location.clone()).expect("Should add location");
    let retrieved = service.get_location("loc1").expect("Should retrieve location");
    assert_eq!(retrieved.id, "loc1");
    assert_eq!(retrieved.name, "NYC Recycler");
}

#[test]
fn test_remove_location() {
    let service = GeoService::new();
    let coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let location = GeoLocation {
        id: "loc1".to_string(),
        name: "NYC Recycler".to_string(),
        coordinates: coords,
        tags: HashMap::new(),
    };

    service.add_location(location).expect("Should add location");
    assert!(service.get_location("loc1").is_some());

    service.remove_location("loc1").expect("Should remove location");
    assert!(service.get_location("loc1").is_none());
}

#[test]
fn test_remove_nonexistent_location() {
    let service = GeoService::new();
    let result = service.remove_location("non-existent");
    assert!(result.is_err());
}

#[test]
fn test_haversine_distance_same_point() {
    let coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let distance = GeoService::haversine_distance(&coords, &coords);
    assert!(distance < 1.0, "Distance to same point should be < 1m");
}

#[test]
fn test_haversine_distance_known_points() {
    let nyc = Coordinates::new(40.7128, -74.0060).unwrap();
    let la = Coordinates::new(34.0522, -118.2437).unwrap();
    let distance = GeoService::haversine_distance(&nyc, &la);

    // Distance between NYC and LA is approximately 3944 km = 3944000 m
    assert!(distance > 3900000.0 && distance < 4000000.0,
            "Distance between NYC and LA should be ~3944km, got {}", distance);
}

#[test]
fn test_calculate_distance() {
    let service = GeoService::new();
    let from = Coordinates::new(40.7128, -74.0060).unwrap();
    let to = Coordinates::new(40.7580, -73.9855).unwrap();

    let result = service.calculate_distance(DistanceQuery { from, to });
    assert!(result.distance_m > 0.0);
    assert!(result.distance_km > 0.0);
    assert!((result.distance_m / 1000.0 - result.distance_km).abs() < 0.1);
}

#[test]
fn test_proximity_search_empty_database() {
    let service = GeoService::new();
    let center = Coordinates::new(40.7128, -74.0060).unwrap();
    let query = ProximityQuery {
        center,
        radius_m: 1000.0,
        filter_tags: HashMap::new(),
        limit: None,
    };

    let results = service.proximity_search(query).expect("Should search");
    assert_eq!(results.len(), 0);
}

#[test]
fn test_proximity_search_with_results() {
    let service = GeoService::new();

    // Add locations
    let center_coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let nearby = Coordinates::new(40.7138, -74.0070).unwrap();
    let far = Coordinates::new(34.0522, -118.2437).unwrap();

    service.add_location(GeoLocation {
        id: "center".to_string(),
        name: "Center".to_string(),
        coordinates: center_coords.clone(),
        tags: HashMap::new(),
    }).unwrap();

    service.add_location(GeoLocation {
        id: "nearby".to_string(),
        name: "Nearby".to_string(),
        coordinates: nearby,
        tags: HashMap::new(),
    }).unwrap();

    service.add_location(GeoLocation {
        id: "far".to_string(),
        name: "Far".to_string(),
        coordinates: far,
        tags: HashMap::new(),
    }).unwrap();

    let query = ProximityQuery {
        center: center_coords,
        radius_m: 2000.0, // 2 km radius
        filter_tags: HashMap::new(),
        limit: None,
    };

    let results = service.proximity_search(query).expect("Should search");
    assert!(results.len() > 0);
}

#[test]
fn test_proximity_search_with_tag_filter() {
    let service = GeoService::new();

    let center_coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let nearby = Coordinates::new(40.7138, -74.0070).unwrap();

    let mut tags_recycler = HashMap::new();
    tags_recycler.insert("type".to_string(), "recycler".to_string());

    let mut tags_landfill = HashMap::new();
    tags_landfill.insert("type".to_string(), "landfill".to_string());

    service.add_location(GeoLocation {
        id: "recycler".to_string(),
        name: "Recycler".to_string(),
        coordinates: nearby.clone(),
        tags: tags_recycler,
    }).unwrap();

    service.add_location(GeoLocation {
        id: "landfill".to_string(),
        name: "Landfill".to_string(),
        coordinates: nearby,
        tags: tags_landfill,
    }).unwrap();

    let mut filter = HashMap::new();
    filter.insert("type".to_string(), "recycler".to_string());

    let query = ProximityQuery {
        center: center_coords,
        radius_m: 2000.0,
        filter_tags: filter,
        limit: None,
    };

    let results = service.proximity_search(query).expect("Should search");
    assert!(results.iter().all(|r| r.location.tags.get("type").map(|t| t == "recycler").unwrap_or(false)));
}

#[test]
fn test_proximity_search_limit() {
    let service = GeoService::new();

    let center = Coordinates::new(40.7128, -74.0060).unwrap();

    // Add multiple locations
    for i in 0..10 {
        let offset = (i as f64) * 0.001;
        let coords = Coordinates::new(40.7128 + offset, -74.0060 + offset).unwrap();
        service.add_location(GeoLocation {
            id: format!("loc{}", i),
            name: format!("Location {}", i),
            coordinates: coords,
            tags: HashMap::new(),
        }).unwrap();
    }

    let query = ProximityQuery {
        center,
        radius_m: 500000.0, // Large radius to catch all
        filter_tags: HashMap::new(),
        limit: Some(5),
    };

    let results = service.proximity_search(query).expect("Should search");
    assert!(results.len() <= 5);
}

#[test]
fn test_invalid_radius() {
    let service = GeoService::new();
    let center = Coordinates::new(40.7128, -74.0060).unwrap();

    let query = ProximityQuery {
        center,
        radius_m: -1000.0, // Invalid negative radius
        filter_tags: HashMap::new(),
        limit: None,
    };

    let result = service.proximity_search(query);
    assert!(result.is_err());
}

#[test]
fn test_nearest_n_locations() {
    let service = GeoService::new();

    let center = Coordinates::new(40.7128, -74.0060).unwrap();

    // Add multiple locations
    for i in 0..10 {
        let offset = (i as f64) * 0.001;
        let coords = Coordinates::new(40.7128 + offset, -74.0060 + offset).unwrap();
        service.add_location(GeoLocation {
            id: format!("loc{}", i),
            name: format!("Location {}", i),
            coordinates: coords,
            tags: HashMap::new(),
        }).unwrap();
    }

    let results = service.nearest(&center, 5);
    assert_eq!(results.len(), 5);

    // Verify results are sorted by distance
    for i in 1..results.len() {
        assert!(results[i].distance_m >= results[i-1].distance_m);
    }
}

#[test]
fn test_nearest_empty_database() {
    let service = GeoService::new();
    let center = Coordinates::new(40.7128, -74.0060).unwrap();

    let results = service.nearest(&center, 5);
    assert_eq!(results.len(), 0);
}

#[test]
fn test_nearest_fewer_than_requested() {
    let service = GeoService::new();

    let center = Coordinates::new(40.7128, -74.0060).unwrap();

    // Add 3 locations
    for i in 0..3 {
        let offset = (i as f64) * 0.001;
        let coords = Coordinates::new(40.7128 + offset, -74.0060 + offset).unwrap();
        service.add_location(GeoLocation {
            id: format!("loc{}", i),
            name: format!("Location {}", i),
            coordinates: coords,
            tags: HashMap::new(),
        }).unwrap();
    }

    let results = service.nearest(&center, 10);
    assert_eq!(results.len(), 3);
}

#[test]
fn test_optimize_route_single_waypoint() {
    let service = GeoService::new();

    let waypoint = Coordinates::new(40.7128, -74.0060).unwrap();
    let request = RouteRequest {
        waypoints: vec![waypoint],
        optimize: true,
    };

    let result = service.optimise_route(request).expect("Should optimize");
    assert_eq!(result.ordered_waypoints.len(), 1);
}

#[test]
fn test_optimize_route_multiple_waypoints() {
    let service = GeoService::new();

    let w1 = Coordinates::new(40.7128, -74.0060).unwrap();
    let w2 = Coordinates::new(40.7138, -74.0070).unwrap();
    let w3 = Coordinates::new(40.7118, -74.0050).unwrap();

    let request = RouteRequest {
        waypoints: vec![w1, w2, w3],
        optimize: true,
    };

    let result = service.optimise_route(request).expect("Should optimize");
    assert_eq!(result.ordered_waypoints.len(), 3);
    assert!(result.total_distance_m > 0.0);
    assert_eq!(result.segments.len(), 2); // n-1 segments for n waypoints
}

#[test]
fn test_optimize_route_no_optimization() {
    let service = GeoService::new();

    let w1 = Coordinates::new(40.7128, -74.0060).unwrap();
    let w2 = Coordinates::new(40.7138, -74.0070).unwrap();

    let request = RouteRequest {
        waypoints: vec![w1.clone(), w2],
        optimize: false,
    };

    let result = service.optimise_route(request).expect("Should optimize");
    assert_eq!(result.ordered_waypoints.len(), 2);
    // First waypoint should be preserved when optimize=false
    assert_eq!(result.ordered_waypoints[0].lat, w1.lat);
    assert_eq!(result.ordered_waypoints[0].lon, w1.lon);
}

#[test]
fn test_optimize_empty_route() {
    let service = GeoService::new();

    let request = RouteRequest {
        waypoints: vec![],
        optimize: true,
    };

    let result = service.optimise_route(request);
    assert!(result.is_err());
}

#[test]
fn test_default_geo_service() {
    let service = GeoService::default();
    assert!(service.get_location("non-existent").is_none());
}

#[test]
fn test_concurrent_add_remove() {
    use std::sync::Arc;
    use std::thread;

    let service = Arc::new(GeoService::new());

    let coords = Coordinates::new(40.7128, -74.0060).unwrap();
    let location = GeoLocation {
        id: "test".to_string(),
        name: "Test".to_string(),
        coordinates: coords,
        tags: HashMap::new(),
    };

    service.add_location(location).unwrap();

    let service_clone1 = Arc::clone(&service);
    let service_clone2 = Arc::clone(&service);

    let handle1 = thread::spawn(move || {
        service_clone1.get_location("test")
    });

    let handle2 = thread::spawn(move || {
        service_clone2.get_location("test")
    });

    let result1 = handle1.join().unwrap();
    let result2 = handle2.join().unwrap();

    assert!(result1.is_some());
    assert!(result2.is_some());
}
