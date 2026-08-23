export interface PinCoordinate { latitude: number; longitude: number }
export interface MapPinPickerProps {
  value: PinCoordinate | null;
  onChange: (coordinate: PinCoordinate) => void;
  initialCenter?: PinCoordinate;
  height?: number;
}
