CREATE OR REPLACE FUNCTION find_nearby_drivers(
  lat DECIMAL,
  lng DECIMAL,
  radius_km DECIMAL
) RETURNS TABLE (
  id UUID,
  name VARCHAR,
  rating DECIMAL,
  vehicle_details JSONB,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.rating,
    u.vehicle_details,
    dl.latitude,
    dl.longitude,
    (6371 * acos(cos(radians(lat)) * cos(radians(dl.latitude)) * cos(radians(dl.longitude) - radians(lng)) + sin(radians(lat)) * sin(radians(dl.latitude)))) AS distance_km
  FROM users u
  INNER JOIN driver_locations dl ON u.id = dl.driver_id
  WHERE u.user_type = 'driver' AND u.current_status = 'online' AND u.verification_status = 'verified'
    AND (6371 * acos(cos(radians(lat)) * cos(radians(dl.latitude)) * cos(radians(dl.longitude) - radians(lng)) + sin(radians(lat)) * sin(radians(dl.latitude)))) <= radius_km
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_driver_stats() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE users SET completed_trips = completed_trips + 1, total_earnings = total_earnings + NEW.total_fare, total_trips = total_trips + 1 WHERE id = NEW.driver_id;
    UPDATE users SET total_trips = total_trips + 1 WHERE id = NEW.passenger_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_stats AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_driver_stats();
