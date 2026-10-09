"""
ChatBrief - WhatsApp Chat Parser
Robust multi-format parser for exported WhatsApp chat .txt files (iOS and Android).
Handles multi-line messages, system events, media indicators, and diverse locale date formats.
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Tuple


class WhatsAppParser:
    # Common regex patterns for Android and iOS chat exports
    # Pattern 1: iOS bracketed format "[DD/MM/YY, HH:MM:SS AM/PM] Sender: Message" or "[DD.MM.YYYY, HH:MM:SS] Sender: Message"
    IOS_PATTERN = re.compile(
        r'^\[(?P<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(?P<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s*[apAP]\.?[mM]\.?)?)\]\s+(?:(?P<sender>[^:]+?):\s+(?P<message>.*)|(?P<system>.*))$'
    )

    # Pattern 2: Android dash format "DD/MM/YYYY, HH:MM - Sender: Message" or "M/D/YY, H:MM AM - Sender: Message"
    ANDROID_PATTERN = re.compile(
        r'^(?P<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(?P<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s*[apAP]\.?[mM]\.?)?)\s+-\s+(?:(?P<sender>[^:]+?):\s+(?P<message>.*)|(?P<system>.*))$'
    )

    # Pattern 3: Standard timestamp start detector to check if a line begins a new message
    TIMESTAMP_START = re.compile(
        r'^(?:\[\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2})'
    )

    MEDIA_OMITTED_PATTERNS = [
        re.compile(r'<media omitted>', re.IGNORECASE),
        re.compile(r'image omitted', re.IGNORECASE),
        re.compile(r'video omitted', re.IGNORECASE),
        re.compile(r'audio omitted', re.IGNORECASE),
        re.compile(r'sticker omitted', re.IGNORECASE),
        re.compile(r'document omitted', re.IGNORECASE),
        re.compile(r'contact card omitted', re.IGNORECASE),
        re.compile(r'gif omitted', re.IGNORECASE),
    ]

    SYSTEM_PATTERNS = [
        re.compile(r'messages and calls are end-to-end encrypted', re.IGNORECASE),
        re.compile(r'created group', re.IGNORECASE),
        re.compile(r'added', re.IGNORECASE),
        re.compile(r'removed', re.IGNORECASE),
        re.compile(r'left', re.IGNORECASE),
        re.compile(r'changed the subject to', re.IGNORECASE),
        re.compile(r'changed the group icon', re.IGNORECASE),
        re.compile(r'changed their phone number', re.IGNORECASE),
        re.compile(r'you were added', re.IGNORECASE),
        re.compile(r'this message was deleted', re.IGNORECASE),
        re.compile(r'you deleted this message', re.IGNORECASE),
        re.compile(r'security code changed', re.IGNORECASE),
    ]

    @classmethod
    def is_media_message(cls, text: str) -> bool:
        for p in cls.MEDIA_OMITTED_PATTERNS:
            if p.search(text):
                return True
        return False

    @classmethod
    def is_system_message(cls, text: str) -> bool:
        for p in cls.SYSTEM_PATTERNS:
            if p.search(text):
                return True
        return False

    @classmethod
    def parse_raw_text(cls, raw_content: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Parses raw WhatsApp chat string into structured message records and calculates stats.
        """
        # Clean UTF-8 BOM, zero-width characters, and non-breaking spaces
        clean_content = raw_content.replace('\ufeff', '').replace('\u200e', '').replace('\u202f', ' ').replace('\xa0', ' ')
        lines = clean_content.splitlines()

        messages: List[Dict[str, Any]] = []
        current_msg: Dict[str, Any] = None
        message_id = 1

        for line in lines:
            line_stripped = line.rstrip()
            if not line_stripped:
                if current_msg:
                    current_msg['text'] += '\n'
                continue

            match = cls.IOS_PATTERN.match(line_stripped)
            if not match:
                match = cls.ANDROID_PATTERN.match(line_stripped)

            if match:
                # Save previous message before starting a new one
                if current_msg:
                    current_msg['text'] = current_msg['text'].strip()
                    if current_msg['text'] or current_msg['is_media']:
                        messages.append(current_msg)
                    current_msg = None

                data = match.groupdict()
                date_str = data.get('date', '').strip()
                time_str = data.get('time', '').strip()
                sender = data.get('sender')
                msg_body = data.get('message')
                sys_msg = data.get('system')

                if sender is not None and msg_body is not None:
                    # Normal user message
                    sender_clean = sender.strip()
                    is_media = cls.is_media_message(msg_body)
                    current_msg = {
                        'id': message_id,
                        'date': date_str,
                        'time': time_str,
                        'sender': sender_clean,
                        'text': msg_body,
                        'is_system': False,
                        'is_media': is_media,
                    }
                    message_id += 1
                elif sys_msg:
                    # System event or notification
                    current_msg = {
                        'id': message_id,
                        'date': date_str,
                        'time': time_str,
                        'sender': 'System',
                        'text': sys_msg.strip(),
                        'is_system': True,
                        'is_media': False,
                    }
                    message_id += 1
            else:
                # Multi-line continuation of current message
                if current_msg:
                    current_msg['text'] += '\n' + line_stripped
                else:
                    # Line without header before first message (e.g. system preamble)
                    if line_stripped:
                        messages.append({
                            'id': message_id,
                            'date': '',
                            'time': '',
                            'sender': 'System',
                            'text': line_stripped,
                            'is_system': True,
                            'is_media': False,
                        })
                        message_id += 1

        # Append last pending message
        if current_msg:
            current_msg['text'] = current_msg['text'].strip()
            if current_msg['text'] or current_msg['is_media']:
                messages.append(current_msg)

        stats = cls.calculate_statistics(messages)
        return messages, stats

    @classmethod
    def calculate_statistics(cls, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates conversation statistics, participant activity, word counts, and time metrics.
        """
        user_messages = [m for m in messages if not m.get('is_system', False)]
        sender_counts: Dict[str, int] = {}
        sender_word_counts: Dict[str, int] = {}
        total_words = 0
        media_count = 0
        hourly_counts: Dict[int, int] = {h: 0 for h in range(24)}
        dates_seen = set()

        for m in user_messages:
            sender = m['sender']
            text = m.get('text', '')
            words = len(text.split()) if text else 0
            total_words += words

            sender_counts[sender] = sender_counts.get(sender, 0) + 1
            sender_word_counts[sender] = sender_word_counts.get(sender, 0) + words

            if m.get('is_media'):
                media_count += 1

            if m.get('date'):
                dates_seen.add(m['date'])

            # Try parsing hour for activity timeline
            time_val = m.get('time', '')
            if time_val:
                match_hour = re.search(r'(\d{1,2}):(\d{2})', time_val)
                if match_hour:
                    h = int(match_hour.group(1))
                    is_pm = bool(re.search(r'[pP]\.?[mM]\.?', time_val))
                    is_am = bool(re.search(r'[aA]\.?[mM]\.?', time_val))
                    if is_pm and h < 12:
                        h += 12
                    elif is_am and h == 12:
                        h = 0
                    if 0 <= h < 24:
                        hourly_counts[h] += 1

        # Sort senders by message count descending
        sorted_senders = sorted(sender_counts.items(), key=lambda x: x[1], reverse=True)
        top_senders = [
            {
                'name': name,
                'messages': count,
                'words': sender_word_counts.get(name, 0),
                'percent': round((count / len(user_messages) * 100) if user_messages else 0, 1)
            }
            for name, count in sorted_senders
        ]

        first_date = messages[0]['date'] if messages and messages[0].get('date') else 'Unknown'
        last_date = messages[-1]['date'] if messages and messages[-1].get('date') else 'Unknown'

        # Peak activity hour
        peak_hour = max(hourly_counts.items(), key=lambda x: x[1])[0] if user_messages else 12
        peak_hour_formatted = f"{peak_hour % 12 or 12}:00 {'PM' if peak_hour >= 12 else 'AM'}"

        return {
            'total_messages': len(messages),
            'user_messages_count': len(user_messages),
            'total_words': total_words,
            'media_count': media_count,
            'unique_participants': len(sender_counts),
            'participants': top_senders,
            'first_date': first_date,
            'last_date': last_date,
            'days_active': len(dates_seen),
            'peak_hour': peak_hour_formatted,
            'hourly_distribution': hourly_counts,
        }
