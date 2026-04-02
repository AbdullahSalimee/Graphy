import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "graphix_secret_change_in_production";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Token expired or invalid. Please sign in again." });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
