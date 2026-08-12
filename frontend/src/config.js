// Utilisez des URLs relatives pour le développement et la production
const backendUrl = process.env.NODE_ENV === 'production' 
  ? ''  // En production, les requêtes passeront par le proxy Nginx
  : 'http://localhost:8000';

const frontendUrl = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : 'http://localhost:3000';

export { backendUrl, frontendUrl };
