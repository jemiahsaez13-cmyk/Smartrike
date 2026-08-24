export interface PinCoordinate { latitude: number; longitude: number }
export interface MapPinPickerProps {
  value: PinCoordinate | null;
  onChange: (coordinate: PinCoordinate | null) => void;
  initialCenter?: PinCoordinate;
  height?: number;
}
