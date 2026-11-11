// Hand-off between the detail screen and the player (avoids huge route params).
let session = null;
export const setSession = (s) => { session = s; };
export const getSession = () => session;
