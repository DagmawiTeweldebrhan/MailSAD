import re
from typing import Optional

# List of regex patterns for bots, image proxies, security scanners, and chat link prefetchers
BOT_PATTERNS = [
    r"GoogleImageProxy",
    r"AppleMailPrivacy",
    r"Barracuda",
    r"Outlook-Express/7\.0",
    r"Slackbot",
    r"Discordbot",
    r"YahooCacheSystem",
    r"Pingdom",
    r"Baiduspider",
    r"YandexBot",
    r"Googlebot",
    r"bingbot"
]

# Compile into a single regex for efficient matching (case-insensitive)
BOT_REGEX = re.compile("|".join(BOT_PATTERNS), re.IGNORECASE)

def is_bot_user_agent(user_agent: Optional[str]) -> bool:
    """
    Checks if a user agent string belongs to an automated email scanner, 
    privacy proxy, or indexing bot.
    """
    if not user_agent:
        return False
    
    return bool(BOT_REGEX.search(user_agent))
