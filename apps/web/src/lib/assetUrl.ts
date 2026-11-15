/** Public-folder URLs that work on localhost and GitHub Pages (/nasa/). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.replace(/^\//, '');
  // Avoid double slashes when base is "/"
  return `${base}${clean}`.replace(/([^:]\/)\/+/g, '$1');
}
