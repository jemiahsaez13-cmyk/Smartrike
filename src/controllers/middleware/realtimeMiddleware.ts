export const realtimeMiddleware = () => (next: any) => (action: any) => {
  return next(action);
};

export default realtimeMiddleware;
