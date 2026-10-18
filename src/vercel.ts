// Vercel function entry: a Node (req, res) listener around the Hono app.
import { getRequestListener } from "@hono/node-server";
import { app } from "./app";

export default getRequestListener(app.fetch);
