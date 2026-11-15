// Where the game screens live. Plain strings, so client components can use them too.
export const clubPath = (clubId: string, rest = "") => `/clubs/${clubId}${rest}`;
export const companyPath = (clubId: string, ticker: string, rest = "") => `/clubs/${clubId}/company/${encodeURIComponent(ticker)}${rest}`;
