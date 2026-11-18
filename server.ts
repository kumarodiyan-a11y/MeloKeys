import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface GuideRequestBody {
  mode?: 'song' | 'coach';
  prompt?: string;
  recentNotes?: string[];
  instrument?: string;
}

interface RawPhrase {
  label?: string;
  notes?: string[];
}

interface RawGuidePayload {
  title?: string;
  tempoBpm?: number;
  coachingTip?: string;
  phrases?: RawPhrase[];
}

const VALID_DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

const KEY_REFERENCE = `
Key mapping (YouTube Grand Piano 10-note C Major Diatonic Instrument):
1 = C4 (Middle C)
2 = D4
3 = E4
4 = F4
5 = G4
6 = A4
7 = B4
8 = C5 (High C)
9 = D5
0 = E5 (Highest note — key 0 is at the right end of the number row)
`.trim();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/guide', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error:
            'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      const body = (req.body ?? {}) as GuideRequestBody;
      const mode = body.mode === 'coach' ? 'coach' : 'song';
      const userPrompt = (body.prompt ?? '').trim();
      const instrument = (body.instrument ?? 'Concert Grand').trim();
      const recentNotes = Array.isArray(body.recentNotes)
        ? body.recentNotes.filter((n) => VALID_DIGITS.has(String(n))).slice(-24)
        : [];

      if (mode === 'song' && !userPrompt) {
        res.status(400).json({
          error: 'Please enter a song name, style, or musical idea for the AI guide.',
        });
        return;
      }

      const instruction =
        mode === 'coach'
          ? `You are a concise, encouraging piano and music teacher guiding a player on a 10-key C Major diatonic keyboard (${KEY_REFERENCE}).
The player currently has "${instrument}" selected.
Look at the sequence of number keys the player just played: ${recentNotes.length > 0 ? recentNotes.join('-') : '(none yet — give them an inviting starter motif)'}.
Compose a musical 3-to-4 phrase continuation or call-and-response exercise that naturally builds on what they played (using ONLY single-digit strings "0" through "9" in each phrase's notes array).
Keep coachingTip to 1-2 crisp sentences explaining what fingers/keys to press and why it sounds good musically.`
          : `You are an expert piano arranger and teacher for a 10-key C Major diatonic keyboard (${KEY_REFERENCE}).
The player currently has "${instrument}" selected.
Arrange or compose playable number-key sheet music matching the user's request: "${userPrompt}".
Rules:
- Use ONLY single-character strings from "0" to "9" inside each phrase's notes array (where "1"=C4, "2"=D4, "3"=E4, "4"=F4, "5"=G4, "6"=A4, "7"=B4, "8"=C5, "9"=D5, "0"=E5).
- Provide 3 to 5 clear phrases of 4 to 8 notes each so the melody is genuinely recognizable and fun to follow step-by-step.
- Set tempoBpm realistically between 72 and 140 for "${instrument}".
- Keep coachingTip concise (1-2 sentences) giving practical playing advice on phrasing or rhythm.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: instruction,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Short title for the melody or guided exercise.',
              },
              tempoBpm: {
                type: Type.INTEGER,
                description: 'Recommended tempo in BPM (between 70 and 145).',
              },
              coachingTip: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence playing tip for the user.',
              },
              phrases: {
                type: Type.ARRAY,
                description: '3 to 5 musical phrases using digits 0-9.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: {
                      type: Type.STRING,
                      description: 'Short phrase label like "Opening Motif" or "Resolution".',
                    },
                    notes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Ordered sequence of single digits "0"-"9".',
                    },
                  },
                  required: ['label', 'notes'],
                },
              },
            },
            required: ['title', 'tempoBpm', 'coachingTip', 'phrases'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'The AI guide returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawText) as RawGuidePayload;
      const sanitizedPhrases = (parsed.phrases ?? [])
        .map((phrase, idx) => {
          const cleanNotes = (phrase.notes ?? [])
            .flatMap((token) => String(token).match(/[0-9]/g) ?? [])
            .filter((d) => VALID_DIGITS.has(d));
          return {
            label: (phrase.label ?? `Phrase ${idx + 1}`).trim(),
            notes: cleanNotes,
          };
        })
        .filter((p) => p.notes.length > 0);

      if (sanitizedPhrases.length === 0) {
        res.status(502).json({
          error: 'Could not extract playable 0–9 notes from the AI response. Please retry.',
        });
        return;
      }

      const tempo = Number.isFinite(parsed.tempoBpm)
        ? Math.max(65, Math.min(160, Math.round(Number(parsed.tempoBpm))))
        : 108;

      res.json({
        title: (parsed.title ?? 'AI Guided Melody').trim(),
        tempoBpm: tempo,
        coachingTip: (
          parsed.coachingTip ?? 'Follow the highlighted gold keys one step at a time.'
        ).trim(),
        phrases: sanitizedPhrases,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error while consulting the AI music guide.';
      console.error('[/api/guide] Error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Keystroke Grand server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
