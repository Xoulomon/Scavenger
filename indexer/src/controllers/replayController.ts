import http from 'http';
import { startReplay } from '../services/replayService';
import { validateReplayBody, RequestValidationError } from '../validation';

export async function handleReplay(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {body += chunk;}

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  try {
    const validated = validateReplayBody(parsed);
    const result = await startReplay(validated);
    res.writeHead(202);
    res.end(JSON.stringify(result));
  } catch (err) {
    if (err instanceof RequestValidationError) {
      res.writeHead(400);
      res.end(JSON.stringify(err.toResponse()));
      return;
    }
    res.writeHead(400);
    res.end(JSON.stringify({ error: String(err) }));
  }
}

export async function handleReplayStatus(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'available', message: 'Replay status tracking is active' }));
}
