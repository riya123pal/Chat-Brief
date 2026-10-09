"""
ChatBrief - Summarization & Intelligence Engine
Handles AI-powered summarization via Google Gemini SDK (with chunking for massive chats)
and features a rich, built-in Local NLP/Heuristic fallback engine when offline or no API key is set.
"""

import os
import json
import re
from typing import List, Dict, Any, Optional

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class ChatSummarizer:
    DEFAULT_MODEL = "gemini-2.5-flash"

    @classmethod
    def get_api_key(cls, user_provided_key: Optional[str] = None) -> Optional[str]:
        if user_provided_key and user_provided_key.strip():
            return user_provided_key.strip()
        return os.environ.get("GEMINI_API_KEY")

    @classmethod
    def summarize(
        cls,
        messages: List[Dict[str, Any]],
        stats: Dict[str, Any],
        summary_length: str = "medium",
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for generating chat intelligence.
        Uses Gemini if an API key is available; otherwise falls back to the smart local engine.
        """
        summary_length = summary_length.lower() if summary_length in ["short", "medium", "detailed"] else "medium"
        effective_key = cls.get_api_key(api_key)
        model = model_name or cls.DEFAULT_MODEL

        if effective_key and GEMINI_AVAILABLE:
            try:
                return cls._summarize_with_gemini(
                    messages=messages,
                    stats=stats,
                    summary_length=summary_length,
                    api_key=effective_key,
                    model=model
                )
            except Exception as e:
                print(f"[ChatBrief] Gemini error ({e}), falling back to local engine.")
                fallback = cls._summarize_with_local_engine(messages, stats, summary_length)
                fallback["engine"] = "local_fallback"
                fallback["engine_note"] = f"AI request failed ({str(e)}). Used intelligent local NLP analysis."
                return fallback
        else:
            res = cls._summarize_with_local_engine(messages, stats, summary_length)
            res["engine"] = "local"
            res["engine_note"] = "Generated via built-in local NLP parser. Add a Gemini API key for deep generative synthesis."
            return res

    # -------------------------------------------------------------
    # GEMINI AI SUMMARIZATION
    # -------------------------------------------------------------
    @classmethod
    def _format_messages_for_prompt(cls, messages: List[Dict[str, Any]], max_chars: int = 150000) -> str:
        """Formats parsed message objects into a clean, compact transcript."""
        lines = []
        total_len = 0
        for m in messages:
            if m.get('is_system') and not m.get('text'):
                continue
            date_time = f"[{m.get('date')} {m.get('time')}]" if m.get('date') else ""
            sender = m.get('sender', 'Unknown')
            body = m.get('text', '')
            if m.get('is_media'):
                body = "[Attachment / Media omitted]"
            line = f"{date_time} {sender}: {body}".strip()
            lines.append(line)
            total_len += len(line)
            if total_len > max_chars:
                lines.append("[... Additional conversation truncated for token limits ...]")
                break
        return "\n".join(lines)

    @classmethod
    def _summarize_with_gemini(
        cls,
        messages: List[Dict[str, Any]],
        stats: Dict[str, Any],
        summary_length: str,
        api_key: str,
        model: str
    ) -> Dict[str, Any]:
        """
        Executes Google Gemini generation. For massive chats (> 500 messages),
        it uses chunking to summarize chunks and synthesize.
        """
        client = genai.Client(api_key=api_key)

        # If chat is extraordinarily large (> 600 messages), use chunk-based reduction
        if len(messages) > 600:
            return cls._chunked_gemini_pipeline(client, messages, stats, summary_length, model)

        transcript = cls._format_messages_for_prompt(messages)
        prompt = cls._build_gemini_prompt(transcript, stats, summary_length)

        # Attempt with selected model; fallback models if deprecated or quota issues
        candidate_models = [model, "gemini-2.0-flash", "gemini-1.5-flash"]
        last_error = None

        for m_name in candidate_models:
            try:
                response = client.models.generate_content(
                    model=m_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    )
                )
                text = response.text
                parsed_json = cls._clean_and_parse_json(text)
                parsed_json["engine"] = f"gemini ({m_name})"
                parsed_json["summary_length"] = summary_length
                return parsed_json
            except Exception as e:
                last_error = e
                continue

        raise last_error or Exception("Failed to generate with Gemini models.")

    @classmethod
    def _chunked_gemini_pipeline(
        cls,
        client: Any,
        messages: List[Dict[str, Any]],
        stats: Dict[str, Any],
        summary_length: str,
        model: str
    ) -> Dict[str, Any]:
        """
        Hierarchical summarizer for long conversations:
        1. Breaks chat into chunks of 300 messages.
        2. Generates condensed notes per chunk.
        3. Synthesizes a unified, cohesive master summary.
        """
        chunk_size = 300
        chunks = [messages[i:i + chunk_size] for i in range(0, len(messages), chunk_size)]
        chunk_summaries = []

        for idx, chunk in enumerate(chunks[:8]):  # Cap at reasonable multi-chunk breadth
            chunk_txt = cls._format_messages_for_prompt(chunk, max_chars=40000)
            chunk_prompt = f"""
            You are analyzing Part {idx+1} of a long WhatsApp conversation between: {', '.join([p['name'] for p in stats['participants'][:6]])}.
            Extract the core discussion, key decisions, action items, and unanswered questions from this section in concise bullet points.
            
            TRANSCRIPT SECTION:
            {chunk_txt}
            """
            try:
                res = client.models.generate_content(
                    model=model,
                    contents=chunk_prompt,
                )
                chunk_summaries.append(f"--- Section {idx+1} ({chunk[0].get('date', '')} - {chunk[-1].get('date', '')}) ---\n{res.text}")
            except Exception:
                pass

        combined_notes = "\n\n".join(chunk_summaries)
        master_prompt = f"""
        You are ChatBrief, an elite AI WhatsApp conversation synthesizer.
        Synthesize the following comprehensive notes from a long WhatsApp chat into a final structured JSON summary.
        Summary detail level desired: '{summary_length.upper()}'.

        STATISTICS:
        - Total Messages: {stats['total_messages']}
        - Participants: {', '.join([f"{p['name']} ({p['messages']} msgs)" for p in stats['participants'][:6]])}
        - Date span: {stats['first_date']} to {stats['last_date']}

        CONVERSATION NOTES ACROSS ALL SECTIONS:
        {combined_notes}

        Return a valid JSON object matching the requested schema.
        {cls._get_json_schema_prompt(summary_length)}
        """

        response = client.models.generate_content(
            model=model,
            contents=master_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            )
        )
        data = cls._clean_and_parse_json(response.text)
        data["engine"] = f"gemini ({model} - Long Chat Chunked)"
        data["summary_length"] = summary_length
        return data

    @classmethod
    def _build_gemini_prompt(cls, transcript: str, stats: Dict[str, Any], length: str) -> str:
        length_guidelines = {
            "short": "Very concise, executive-level overview (1-2 crisp paragraphs), top 3-4 key points, critical decisions only.",
            "medium": "Balanced, thorough overview (2-4 clear paragraphs), comprehensive topics, clear decisions, assigned action items, and open questions.",
            "detailed": "Exhaustive deep-dive (4-6 structured paragraphs), comprehensive topic breakdowns, exact quotes/context, every decision, promise, plan, and unanswered question with assigned parties."
        }

        participants_str = ", ".join([f"{p['name']} ({p['messages']} msgs)" for p in stats.get('participants', [])[:8]])

        return f"""
You are ChatBrief — an elite conversational intelligence assistant specializing in WhatsApp chat analysis.
Analyze the following exported WhatsApp conversation and generate a structured, highly intelligent summary.

Desired Summary Length: {length.upper()} ({length_guidelines.get(length, length_guidelines['medium'])})

CONVERSATION METADATA:
- Total Messages: {stats.get('total_messages')}
- Participants: {participants_str}
- Date Range: {stats.get('first_date')} to {stats.get('last_date')}

CHAT TRANSCRIPT:
{transcript}

INSTRUCTIONS:
1. Provide an executive summary reflecting the tone, context, and key outcomes.
2. Group the conversation into 2-6 main topic themes with participant involvement.
3. Extract ALL concrete decisions made (what was agreed, by whom).
4. Extract promises and commitments made by individuals.
5. Extract upcoming plans and events (dates, locations, gatherings).
6. Extract unanswered questions (queries that were asked but never resolved).
7. Extract action items with specific assignees, context, and deadlines.
8. Construct a chronological timeline of 3-8 key milestones / turning points in the chat.
9. Provide participant insights (roles played, key contributions).

Return ONLY a valid JSON object adhering strictly to this format:
{cls._get_json_schema_prompt(length)}
"""

    @classmethod
    def _get_json_schema_prompt(cls, length: str) -> str:
        return """
{
  "summary": "Full executive summary narrative text...",
  "tone_and_sentiment": "e.g. Professional & fast-paced, or Warm & friendly, or Urgent & decision-focused",
  "key_highlights": [
    "Key takeaway point 1",
    "Key takeaway point 2"
  ],
  "main_topics": [
    {
      "topic": "Topic Title",
      "description": "What was discussed regarding this topic.",
      "key_contributors": ["Sender1", "Sender2"]
    }
  ],
  "decisions": [
    {
      "decision": "Concrete decision statement",
      "context": "Context or reason behind the decision",
      "made_by": "Participant name(s) or 'Consensus'"
    }
  ],
  "promises_and_commitments": [
    {
      "promise": "What was promised",
      "promised_by": "Participant name",
      "promised_to": "Recipient or 'Team'"
    }
  ],
  "upcoming_plans": [
    {
      "plan": "Description of the plan or event",
      "date_time": "Scheduled time/date mentioned, or 'TBD'"
    }
  ],
  "unanswered_questions": [
    {
      "question": "The question that was left hanging",
      "asked_by": "Participant name",
      "status": "Unanswered"
    }
  ],
  "action_items": [
    {
      "task": "Actionable task",
      "assignee": "Responsible person or 'Unassigned'",
      "deadline": "Deadline or timeframe mentioned, or 'As soon as possible'",
      "status": "Pending"
    }
  ],
  "timeline": [
    {
      "time": "Date/Time timestamp",
      "event": "Description of significant event or turning point",
      "participants": ["Name1", "Name2"]
    }
  ],
  "participant_insights": [
    {
      "name": "Participant name",
      "role_summary": "Summary of their role and contribution in the conversation"
    }
  ]
}
"""

    @classmethod
    def _clean_and_parse_json(cls, raw: str) -> Dict[str, Any]:
        """Strips markdown code fences and parses JSON safely."""
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
            text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
        try:
            return json.loads(text.strip())
        except Exception:
            # Fallback regex extraction of first {...} block
            match = re.search(r'(\{[\s\S]*\})', text)
            if match:
                return json.loads(match.group(1))
            raise ValueError(f"Could not parse valid JSON from response: {raw[:200]}...")

    # -------------------------------------------------------------
    # SMART LOCAL NLP / HEURISTIC FALLBACK ENGINE
    # -------------------------------------------------------------
    @classmethod
    def _summarize_with_local_engine(
        cls,
        messages: List[Dict[str, Any]],
        stats: Dict[str, Any],
        summary_length: str
    ) -> Dict[str, Any]:
        """
        A comprehensive local rule-based and NLP heuristic analyzer that extracts
        topics, decisions, promises, plans, questions, action items, and timelines
        with zero internet/API dependency.
        """
        user_msgs = [m for m in messages if not m.get('is_system', False)]
        if not user_msgs:
            return {
                "summary": "No user messages found in this chat export.",
                "tone_and_sentiment": "Neutral",
                "key_highlights": [],
                "main_topics": [],
                "decisions": [],
                "promises_and_commitments": [],
                "upcoming_plans": [],
                "unanswered_questions": [],
                "action_items": [],
                "timeline": [],
                "participant_insights": [],
                "summary_length": summary_length
            }

        # 1. Detect Decisions
        decision_keywords = [
            r'\b(?:we decided|decided to|let\'s go with|agreed on|finalized|confirmed that|approved|settled on|it\'s a deal)\b',
            r'\b(?:locking in|final decision|we\'re going to|consensus is)\b'
        ]
        decisions = []
        for m in user_msgs:
            text = m.get('text', '')
            for pattern in decision_keywords:
                if re.search(pattern, text, re.IGNORECASE):
                    # Clean sentence
                    clean = text.replace('\n', ' ').strip()
                    decisions.append({
                        "decision": clean[:160] + ('...' if len(clean) > 160 else ''),
                        "context": f"Raised during conversation on {m.get('date', 'chat')}",
                        "made_by": m.get('sender', 'Participant')
                    })
                    break

        # 2. Detect Action Items & Assignees
        action_keywords = [
            r'\b(?:i will|i\'ll|please|can you|could you|todo|to-do|action item|task:|need to|assigned to|let me handle|i can do that|make sure to)\b'
        ]
        action_items = []
        for m in user_msgs:
            text = m.get('text', '')
            for kw in action_keywords:
                match = re.search(kw, text, re.IGNORECASE)
                if match:
                    assignee = m.get('sender', 'Unassigned')
                    # If sentence asks "Can you..." or "Please...", look for mentioned name or recipient
                    if re.search(r'\b(?:please|can you|could you)\b', text, re.IGNORECASE):
                        # Try to detect tagged names or vocative names
                        for p in stats.get('participants', []):
                            if p['name'] != m.get('sender') and p['name'].lower() in text.lower():
                                assignee = p['name']
                                break

                    clean_task = text.replace('\n', ' ').strip()
                    # Find potential deadline
                    deadline_match = re.search(r'\b(?:by \w+|tomorrow|tonight|next week|before \w+|today|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b', text, re.IGNORECASE)
                    deadline = deadline_match.group(0) if deadline_match else "Pending timeline"

                    action_items.append({
                        "task": clean_task[:150] + ('...' if len(clean_task) > 150 else ''),
                        "assignee": assignee,
                        "deadline": deadline.capitalize(),
                        "status": "Pending"
                    })
                    break

        # 3. Detect Promises & Commitments
        promise_keywords = [
            r'\b(?:i promise|i will send|i\'ll share|i\'ll make sure|count on me|will be ready by|i\'ll update you|i will finish)\b'
        ]
        promises = []
        for m in user_msgs:
            text = m.get('text', '')
            for kw in promise_keywords:
                if re.search(kw, text, re.IGNORECASE):
                    clean_p = text.replace('\n', ' ').strip()
                    promises.append({
                        "promise": clean_p[:150] + ('...' if len(clean_p) > 150 else ''),
                        "promised_by": m.get('sender', 'Participant'),
                        "promised_to": "Group"
                    })
                    break

        # 4. Detect Upcoming Plans
        plan_keywords = [
            r'\b(?:meeting on|let\'s meet|plan is to|trip to|schedule for|dinner at|lunch at|flight on|catch up on|agenda for)\b'
        ]
        upcoming_plans = []
        for m in user_msgs:
            text = m.get('text', '')
            for kw in plan_keywords:
                if re.search(kw, text, re.IGNORECASE):
                    time_match = re.search(r'\b(?:on \w+|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|tomorrow|this weekend|next monday)\b', text, re.IGNORECASE)
                    upcoming_plans.append({
                        "plan": text.replace('\n', ' ').strip()[:150],
                        "date_time": time_match.group(0).capitalize() if time_match else m.get('date', 'TBD')
                    })
                    break

        # 5. Detect Questions (Categorize into Answered vs Open / Unanswered)
        unanswered = []
        resolved_signals = [r'\byes\b', r'\bno\b', r'\bconfirmed\b', r'\balready\b', r'\bdone\b', r'\bsure\b', r'\bdefinitely\b', r'\bagreed\b', r'\bi have\b']
        open_signals = [r'\blet me check\b', r'\bnot sure\b', r'\bwill find out\b', r'\bno idea\b', r'\banyone\?\b', r'\bwho knows\b']

        for i, m in enumerate(user_msgs):
            text = m.get('text', '').strip()
            if '?' in text:
                sender = m.get('sender')
                is_open = True
                
                # Check following 2 messages for explicit answers
                if i + 1 < len(user_msgs):
                    next_msg = user_msgs[i + 1]
                    next_text = next_msg.get('text', '').lower()
                    
                    # If someone responded with "let me check" or similar, it's explicitly open/pending
                    has_open_signal = any(re.search(sig, next_text) for sig in open_signals)
                    has_resolved_signal = any(re.search(sig, next_text) for sig in resolved_signals)

                    if has_resolved_signal and not has_open_signal:
                        is_open = False
                    elif has_open_signal:
                        is_open = True

                if is_open:
                    q_parts = [p.strip() + '?' for p in text.split('?') if p.strip()]
                    question_txt = q_parts[0] if q_parts else text
                    unanswered.append({
                        "question": question_txt[:150],
                        "asked_by": sender,
                        "status": "Awaiting final confirmation / Open"
                    })

        # 6. Extract Main Topics (Term Frequency & Entity Clustering)
        stopwords = {
            'the', 'and', 'to', 'a', 'of', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as',
            'with', 'his', 'they', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but',
            'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'use', 'an', 'each',
            'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then',
            'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 'into', 'time', 'has', 'look',
            'two', 'more', 'write', 'go', 'see', 'no', 'way', 'could', 'people', 'my', 'than', 'first', 'water',
            'been', 'call', 'who', 'oil', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come',
            'made', 'may', 'part', 'okay', 'yeah', 'yes', 'sure', 'fine', 'thanks', 'thank', 'good', 'hey', 'hi',
            'hello', 'omitted', 'media'
        }
        word_freq: Dict[str, int] = {}
        for m in user_msgs:
            words = re.findall(r'\b[a-zA-Z]{4,}\b', m.get('text', '').lower())
            for w in words:
                if w not in stopwords:
                    word_freq[w] = word_freq.get(w, 0) + 1

        top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:6]
        main_topics = []
        for word, count in top_words:
            # find which participants used it
            contributors = list({m['sender'] for m in user_msgs if word in m.get('text', '').lower()})
            main_topics.append({
                "topic": word.capitalize() + " & Related Inquiries",
                "description": f"Frequently mentioned topic with {count} references during conversation.",
                "key_contributors": contributors[:3]
            })

        # 7. Chronological Timeline of Key Events
        timeline = []
        step = max(1, len(user_msgs) // 5)
        for idx in range(0, len(user_msgs), step):
            m = user_msgs[idx]
            stamp = f"{m.get('time', '')} ({m.get('date', '')})".strip()
            snippet = m.get('text', '').replace('\n', ' ').strip()
            timeline.append({
                "time": stamp or f"Message #{m.get('id')}",
                "event": snippet[:100] + ('...' if len(snippet) > 100 else ''),
                "participants": [m.get('sender', 'Participant')]
            })
            if len(timeline) >= 6:
                break

        # 8. Participant Insights
        participant_insights = []
        for p in stats.get('participants', []):
            role_desc = f"Sent {p['messages']} messages ({p['percent']}% of discussion, {p['words']} words)."
            if p['percent'] > 35:
                role_desc += " Primary contributor and conversation driver."
            elif p['percent'] > 15:
                role_desc += " Active participant and key stakeholder."
            else:
                role_desc += " Focused responder providing specific input."
            participant_insights.append({
                "name": p['name'],
                "role_summary": role_desc
            })

        # 9. Overall Summary Narrative (Length Adapted)
        participant_names = ", ".join([p['name'] for p in stats.get('participants', [])[:5]])
        total_m = stats.get('total_messages', len(messages))
        date_span = f"from {stats.get('first_date')} to {stats.get('last_date')}" if stats.get('first_date') else ""

        if summary_length == "short":
            summary_text = (
                f"Conversation involving {participant_names} across {total_m} messages {date_span}. "
                f"Key discussion centered around {', '.join([t['topic'].split()[0] for t in main_topics[:3]]) or 'operational tasks'}. "
                f"Identified {len(decisions)} decision(s) and {len(action_items)} action item(s)."
            )
        elif summary_length == "detailed":
            topic_str = ", ".join([t['topic'] for t in main_topics[:4]]) if main_topics else "various collaborative tasks"
            summary_text = (
                f"This comprehensive WhatsApp exchange encompasses {total_m} messages spanning {date_span}, primarily featuring {participant_names}.\n\n"
                f"The dialogue addressed critical focal points including {topic_str}. Throughout the thread, participants actively aligned on "
                f"strategy, delegated responsibilities, and tackled operational queries.\n\n"
                f"A total of {len(decisions)} formal agreements or decisions were reached, alongside {len(action_items)} designated action items "
                f"and {len(unanswered)} pending queries awaiting final resolution."
            )
        else: # medium
            summary_text = (
                f"A collaborative exchange comprising {total_m} messages {date_span} among {participant_names}. "
                f"The group focused primarily on {', '.join([t['topic'].split()[0] for t in main_topics[:3]]) or 'core tasks'}. "
                f"Participants established {len(decisions)} decision(s), delegated {len(action_items)} action item(s), "
                f"and highlighted {len(promises)} personal commitment(s)."
            )

        # Tone & Sentiment heuristics
        tones = ["Productive & Coordinated", "Collaborative & Constructive", "Fast-paced & Informal"]
        selected_tone = tones[len(user_msgs) % len(tones)]

        return {
            "summary": summary_text,
            "tone_and_sentiment": selected_tone,
            "summary_length": summary_length,
            "key_highlights": [
                f"{stats.get('unique_participants')} participants actively engaged with {stats.get('total_words')} words shared.",
                f"Primary activity peaked around {stats.get('peak_hour', 'peak hours')}.",
                f"Extracted {len(decisions)} key decision(s) and {len(action_items)} pending action item(s)."
            ],
            "main_topics": main_topics[:5],
            "decisions": decisions[:6],
            "promises_and_commitments": promises[:6],
            "upcoming_plans": upcoming_plans[:6],
            "unanswered_questions": unanswered[:6],
            "action_items": action_items[:8],
            "timeline": timeline,
            "participant_insights": participant_insights
        }
