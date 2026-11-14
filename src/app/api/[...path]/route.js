// Một route handler duy nhất cho toàn bộ REST API (/api/*).
// Request được chuyển vào các Express Router của FastWork (src/server/app.js).
import { getApi } from "@/server/app";
import { runExpressRouter } from "@/server/http/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (request) => runExpressRouter(getApi(), request);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
