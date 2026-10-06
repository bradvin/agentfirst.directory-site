-- Only an allowlisted public aggregate projection; no upstream responses or credentials.
CREATE TABLE public_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot TEXT NOT NULL CHECK (json_valid(snapshot))
);
