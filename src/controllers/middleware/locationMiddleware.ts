export const locationMiddleware = () => (next: any) => (action: any) => {
  return next(action);
};

export default locationMiddleware;
