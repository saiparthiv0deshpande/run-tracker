export function requireUser(request, response, next) {
  if (!request.session?.userId) {
    return response.status(401).json({ message: 'Please sign in to continue.' });
  }

  next();
}
