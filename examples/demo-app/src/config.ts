// SPDX-License-Identifier: MIT
// Common configuration for the demo app

// If yarn build is called (production), use the live backend, otherwise use localhost
export const baseUrl: string =
  process.env.NODE_ENV === 'production'
    ? 'https://gridmaps.geosoftsolution.com'
    : 'http://localhost:8000';

export default baseUrl;
