# API Key Configuration

This document explains how API keys are used in Exammer for different services.

## Overview

Exammer uses two types of API key configurations:

1. **GEMINI_API_KEY_BILLED** - Single billed key for high-cost operations
2. **GEMINI_API_KEYS_PARALLEL** - Multiple keys for rate-limited parallel operations

---

## GEMINI_API_KEY_BILLED

**Used For:**
- 🎙️ **Gemini Live** - Voice interview sessions
- 🎨 **Imagen 3** - AI diagram image generation

**Why Separate?**
- These services have higher costs per request
- Easier to track billing for expensive operations
- No rate limiting needed (billed operations scale automatically)

**Configuration:**
```env
GEMINI_API_KEY_BILLED=your-actual-api-key-here
```

**Files Using This Key:**
- `src/app/api/gemini/live-token/route.ts` - Returns key for voice interview WebSocket
- `src/ai/flows/generate-diagram-image.ts` - Uses key for Imagen 3 generation

---

## GEMINI_API_KEYS_PARALLEL

**Used For:**
- 📝 **Question Generation** - AI-powered interview questions
- 📄 **Paper Extraction** - Extracting questions from PDFs
- 📋 **Markscheme Processing** - Processing solution markschemes
- 🔄 **Question Variants** - Generating similar practice questions

**Why Multiple Keys?**
- Avoids rate limits by rotating through keys
- Allows parallel processing of many requests
- Cost-effective for high-volume operations

**Configuration:**
```env
GEMINI_API_KEYS_PARALLEL='["key1","key2","key3","key4","key5"]'
```

**Files Using These Keys:**
- `src/ai/flows/extract-paper-questions.ts`
- `src/ai/flows/extract-markscheme-solutions.ts`
- `src/ai/flows/generate-similar-question.ts`
- `src/ai/flows/ai-powered-interview.ts`
- And others via `geminiApiKeyManager`

---

## Setup Instructions

### 1. Get Your API Keys

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create API keys.

**For GEMINI_API_KEY_BILLED:**
- Create one API key
- **Enable billing** on the associated Google Cloud project
- Required for Gemini Live and Imagen 3

**For GEMINI_API_KEYS_PARALLEL:**
- Create 5-8 API keys (or more for higher throughput)
- Free tier is sufficient for these operations
- Each key has its own rate limit, so more keys = more parallel capacity

### 2. Configure .env

Create or edit `.env` in the project root:

```env
# Billed key for voice interviews and image generation
GEMINI_API_KEY_BILLED=AIzaSyD...your-actual-key

# Parallel keys for question processing (JSON array)
GEMINI_API_KEYS_PARALLEL='["AIzaSyA...key1","AIzaSyB...key2","AIzaSyC...key3"]'
```

### 3. Restart Server

After updating `.env`, restart the development server:
```bash
npm run dev
```

---

## Cost Estimates

### Using GEMINI_API_KEY_BILLED

| Service | Cost per Request | Notes |
|---------|-----------------|-------|
| **Gemini Live** | ~$0.01-0.05 | Per minute of conversation |
| **Imagen 3** | ~$0.04 | Per generated image |

**Monthly Cost Examples:**
- 100 voice sessions (10 min avg): ~$5-25
- 1000 diagram images: ~$40
- Combined typical usage: ~$50-100/month

### Using GEMINI_API_KEYS_PARALLEL

| Service | Cost per Request | Notes |
|---------|-----------------|-------|
| **Question Generation** | ~$0.001 | Per question variant |
| **Paper Extraction** | ~$0.01 | Per exam paper |
| **Text Processing** | ~$0.0001-0.001 | Per operation |

**Monthly Cost Examples:**
- 5000 question generations: ~$5
- 100 paper extractions: ~$1
- Combined typical usage: ~$5-10/month

---

## Troubleshooting

### Error: "GEMINI_API_KEY_BILLED not found"

**Solution:**
1. Check that `.env` file exists in project root
2. Verify the key name is spelled correctly: `GEMINI_API_KEY_BILLED`
3. Restart the dev server after adding the key

### Voice Interview Not Working

**Check:**
1. `GEMINI_API_KEY_BILLED` is set in `.env`
2. The API key has billing enabled
3. Gemini Live API is enabled in your Google Cloud project

### Image Generation Failing

**Check:**
1. `GEMINI_API_KEY_BILLED` is set in `.env`
2. The API key has billing enabled
3. Imagen 3 API is enabled in your Google Cloud project
4. Check console logs for specific error messages

### Rate Limiting Issues

**For parallel operations:**
- Add more keys to `GEMINI_API_KEYS_PARALLEL`
- Each key provides additional capacity

**For billed operations:**
- Increase quotas in Google Cloud Console
- Billed APIs generally have higher default limits

---

## Security Best Practices

1. **Never commit `.env` file** - It contains secret keys
2. **Use different keys for dev/prod** - Separate environments
3. **Rotate keys regularly** - Update keys every few months
4. **Monitor usage** - Check Google Cloud Console for unexpected usage
5. **Set budget alerts** - Get notified if costs exceed threshold

---

## Migration Notes

### Previous Setup
- All operations used `geminiApiKeyManager` with parallel keys
- Single key pool for all operations

### Current Setup (After This Update)
- High-cost operations use dedicated billed key
- Standard operations continue using parallel keys
- Better cost tracking and scaling

### What Changed
- `src/app/api/gemini/live-token/route.ts` - Now returns `GEMINI_API_KEY_BILLED`
- `src/ai/flows/generate-diagram-image.ts` - Now uses `GEMINI_API_KEY_BILLED` directly
- `.env.example` - Updated with new key documentation
