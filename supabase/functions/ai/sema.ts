// ai/sema.json kopyası — elle düzenleme, birlestir.py üretir.
export const SEMA = {
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://shootboard.app/ai/sema.json",
 "title": "Shootboard transfer package",
 "description": "A batch of content for a Shootboard account: calendar entries, projects (shoots), places, scripts and ideas. Produced by any AI assistant or tool. Either pasted into Shootboard (Import window) or sent to POST /import of the Shootboard AI API. Field names match Shootboard's own data model; Turkish top-level aliases (kayitlar, projeler, mekanlar, scriptler, fikirler) are accepted so a Shootboard backup file is also a valid package.",
 "type": "object",
 "properties": {
  "shootboard": {
   "type": "integer",
   "const": 1,
   "description": "Package format version. Always 1."
  },
  "source": {
   "type": "string",
   "maxLength": 60,
   "description": "Who produced the package, e.g. \"ChatGPT\", \"Claude\", \"Zapier\". Shown in the account's import log; used for the AI badge and undo."
  },
  "note": {
   "type": "string",
   "maxLength": 300,
   "description": "Optional one-line summary of what this batch is (\"September plan, 3 shoots\"). Shown in the import log."
  },
  "projects": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Project"
   }
  },
  "places": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Place"
   }
  },
  "entries": {
   "type": "array",
   "maxItems": 200,
   "items": {
    "$ref": "#/$defs/Entry"
   }
  },
  "scripts": {
   "type": "array",
   "maxItems": 50,
   "items": {
    "$ref": "#/$defs/Script"
   }
  },
  "ideas": {
   "type": "array",
   "maxItems": 100,
   "items": {
    "$ref": "#/$defs/Idea"
   }
  },
  "projeler": {
   "$ref": "#/properties/projects",
   "description": "Turkish alias of projects (backup file format)."
  },
  "mekanlar": {
   "$ref": "#/properties/places",
   "description": "Turkish alias of places."
  },
  "kayitlar": {
   "$ref": "#/properties/entries",
   "description": "Turkish alias of entries."
  },
  "scriptler": {
   "$ref": "#/properties/scripts",
   "description": "Turkish alias of scripts."
  },
  "fikirler": {
   "$ref": "#/properties/ideas",
   "description": "Turkish alias of ideas."
  }
 },
 "additionalProperties": true,
 "x-order": "Places are imported first, then projects (so a project can name its places), then entries, scripts and ideas (so they can name their project). Within one package a project may be referenced by name before it is created.",
 "x-limits": {
  "perPackage": 200,
  "perAccount": {
   "entries": "100 by default (trial accounts); the account's own limit is returned by GET /me",
   "projects": "100 by default",
   "places": 400,
   "scripts": 300,
   "ideas": 500
  }
 },
 "x-idempotency": "Projects and places are matched by name (case-insensitive, trimmed): sending the same name again updates that row instead of creating a second one. Entries, scripts and ideas have no natural key: sending them twice creates them twice, unless you set the same id both times. If you set ids, make them unique to this package (e.g. add a random suffix); an id that already belongs to another account is rejected.",
 "$defs": {
  "Id": {
   "type": "string",
   "pattern": "^[A-Za-z0-9_-]{1,64}$",
   "description": "Optional stable identifier. Omit it and Shootboard generates one; the response tells you which id each item received. Set it only when you want to resend the same item later to update it."
  },
  "DateYMD": {
   "type": "string",
   "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
   "description": "Calendar date, YYYY-MM-DD, in the creator's local calendar."
  },
  "TimeHM": {
   "type": "string",
   "pattern": "^\\d{2}:\\d{2}$",
   "description": "Local time of day, 24-hour HH:MM."
  },
  "ProjectRef": {
   "type": "string",
   "maxLength": 120,
   "description": "The project this item belongs to: the project's name (case-insensitive) or its id. When the name matches nothing in the account and nothing in this package, the item is still imported without a project link and a warning is returned. To create the project, include it in `projects`."
  },
  "Entry": {
   "type": "object",
   "description": "One planned post on the calendar: what goes out, where, when. Shootboard never publishes anything itself; `uploaded` is a checkbox the creator ticks after posting by hand.",
   "required": [
    "date",
    "platform"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "date": {
     "$ref": "#/$defs/DateYMD"
    },
    "time": {
     "$ref": "#/$defs/TimeHM"
    },
    "type": {
     "type": "string",
     "enum": [
      "video",
      "shorts",
      "reels",
      "carousel",
      "story",
      "text_post",
      "poll"
     ],
     "default": "video",
     "description": "Post format. video = long-form (YouTube video, Facebook video); shorts = YouTube Shorts; reels = Instagram/Facebook Reels or TikTok clip; carousel = multi-image post; story = 24-hour story; text_post = text-only post (Threads, X, LinkedIn, Facebook); poll = poll post. Unknown values fall back to video."
    },
    "platform": {
     "type": "string",
     "enum": [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "threads",
      "x",
      "pinterest",
      "linkedin"
     ],
     "description": "Where it will be posted. One entry per platform: a video announced on four platforms is four entries. Unknown values fall back to youtube."
    },
    "title": {
     "type": "string",
     "maxLength": 300,
     "description": "Short label shown on the calendar card. Keep it under ~60 characters."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "uploaded": {
     "type": "boolean",
     "default": false,
     "description": "Already posted. Leave false for anything planned."
    },
    "content": {
     "type": "object",
     "description": "What actually goes out. All optional.",
     "properties": {
      "caption": {
       "type": "string",
       "maxLength": 5000,
       "description": "Post text / description for this platform."
      },
      "hashtags": {
       "type": "string",
       "maxLength": 1000,
       "description": "Hashtags as one string, space separated, each starting with #."
      },
      "videoTitle": {
       "type": "string",
       "maxLength": 300,
       "description": "YouTube video title (long-form)."
      },
      "shortTitle": {
       "type": "string",
       "maxLength": 300,
       "description": "Title for shorts / reels."
      },
      "thumbPrompt": {
       "type": "string",
       "maxLength": 5000,
       "description": "Thumbnail idea or image-generation prompt."
      },
      "slidePrompts": {
       "type": "array",
       "maxItems": 9,
       "items": {
        "type": "string",
        "maxLength": 2000
       },
       "description": "Carousel only: one prompt/description per slide, in order."
      },
      "timezone": {
       "type": "string",
       "maxLength": 64,
       "description": "IANA time zone the date/time are given in (e.g. Europe/Istanbul). Leave empty for the creator's own zone."
      }
     },
     "additionalProperties": false
    }
   },
   "additionalProperties": false
  },
  "Project": {
   "type": "object",
   "description": "A shoot: one filming effort that later becomes many posts. Entries, scripts and ideas link to it by name.",
   "required": [
    "name"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "name": {
     "type": "string",
     "minLength": 1,
     "maxLength": 120,
     "description": "Unique within the account (case-insensitive). Reusing a name updates that project."
    },
    "type": {
     "type": "string",
     "enum": [
      "outdoor",
      "venue",
      "studio",
      "vlog",
      "review",
      "desk",
      "other"
     ],
     "default": "other",
     "description": "Where the work happens. outdoor = on location outside; venue = inside a place (museum, shop, restaurant); studio; vlog; review = product review; desk = screen/desk work; other. Outdoor and venue shoots expect an address or a place."
    },
    "shootDate": {
     "$ref": "#/$defs/DateYMD",
     "description": "Planned filming day."
    },
    "keywords": {
     "type": "string",
     "maxLength": 200,
     "description": "Search terms / tags for this shoot, comma separated."
    },
    "notes": {
     "type": "string",
     "maxLength": 2000
    },
    "address": {
     "type": "string",
     "maxLength": 300,
     "description": "Free-text address when the shoot is not tied to a saved place."
    },
    "places": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "type": "string",
      "maxLength": 160
     },
     "description": "Ordered stops of the shoot, each a place name (case-insensitive) or place id. Names that match nothing are reported as warnings; add them to `places` in the same package to create them."
    },
    "topic": {
     "type": "string",
     "maxLength": 300,
     "description": "What the video is about."
    },
    "city": {
     "type": "string",
     "maxLength": 120
    },
    "district": {
     "type": "string",
     "maxLength": 120
    },
    "format": {
     "type": "string",
     "maxLength": 60,
     "description": "Free text: documentary, interview, walk-and-talk..."
    },
    "permission": {
     "type": "string",
     "maxLength": 300,
     "description": "Filming permission status / who to ask."
    },
    "scriptUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "driveUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "mapsUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "fieldNotes": {
     "type": "string",
     "maxLength": 4000
    },
    "cautions": {
     "type": "string",
     "maxLength": 4000,
     "description": "Things to watch out for on the day."
    },
    "shotList": {
     "type": "string",
     "maxLength": 4000,
     "description": "Shots to get, one per line."
    },
    "cancelled": {
     "type": "boolean",
     "default": false
    },
    "steps": {
     "type": "object",
     "description": "Production checklist. true = done.",
     "properties": {
      "script": {
       "type": "boolean"
      },
      "filmed": {
       "type": "boolean"
      },
      "audio": {
       "type": "boolean"
      },
      "edited": {
       "type": "boolean"
      },
      "approved": {
       "type": "boolean"
      },
      "package": {
       "type": "boolean"
      },
      "published": {
       "type": "boolean"
      }
     },
     "additionalProperties": false
    },
    "deadlines": {
     "type": "object",
     "description": "Optional due date per checklist step, YYYY-MM-DD.",
     "properties": {
      "script": {
       "$ref": "#/$defs/DateYMD"
      },
      "filmed": {
       "$ref": "#/$defs/DateYMD"
      },
      "audio": {
       "$ref": "#/$defs/DateYMD"
      },
      "edited": {
       "$ref": "#/$defs/DateYMD"
      },
      "approved": {
       "$ref": "#/$defs/DateYMD"
      },
      "package": {
       "$ref": "#/$defs/DateYMD"
      },
      "published": {
       "$ref": "#/$defs/DateYMD"
      }
     },
     "additionalProperties": false
    }
   },
   "additionalProperties": false
  },
  "Place": {
   "type": "object",
   "description": "A filming location that is reused across shoots: address, permission notes, what to watch out for.",
   "required": [
    "name"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "name": {
     "type": "string",
     "minLength": 1,
     "maxLength": 160,
     "description": "Unique within the account (case-insensitive). Reusing a name updates that place."
    },
    "city": {
     "type": "string",
     "maxLength": 120
    },
    "district": {
     "type": "string",
     "maxLength": 120
    },
    "address": {
     "type": "string",
     "maxLength": 400,
     "description": "Street address. Do not invent one; leave empty if unknown, the creator can look it up in Shootboard."
    },
    "country": {
     "type": "string",
     "maxLength": 80
    },
    "lat": {
     "type": "number",
     "minimum": -85,
     "maximum": 85
    },
    "lon": {
     "type": "number",
     "minimum": -180,
     "maximum": 180
    },
    "timezone": {
     "type": "string",
     "maxLength": 64,
     "description": "IANA time zone of the place."
    },
    "mapsUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri",
     "description": "Google Maps / OpenStreetMap link."
    },
    "driveUrl": {
     "type": "string",
     "maxLength": 600,
     "format": "uri"
    },
    "permission": {
     "type": "string",
     "maxLength": 400,
     "description": "Who grants filming permission, what it costs, how long it takes."
    },
    "cautions": {
     "type": "string",
     "maxLength": 2000
    },
    "notes": {
     "type": "string",
     "maxLength": 4000
    }
   },
   "additionalProperties": false
  },
  "Script": {
   "type": "object",
   "description": "A script or long text for a shoot. Stored with source = \"ai\" so the creator can see where it came from.",
   "anyOf": [
    {
     "required": [
      "title"
     ]
    },
    {
     "required": [
      "text"
     ]
    }
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "title": {
     "type": "string",
     "maxLength": 160
    },
    "text": {
     "type": "string",
     "maxLength": 40000,
     "description": "Plain text or light Markdown. Keep scene headings and speaker labels as plain lines."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "projects": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "$ref": "#/$defs/ProjectRef"
     },
     "description": "A script can belong to several shoots. Overrides `project` when given."
    }
   },
   "additionalProperties": false
  },
  "Idea": {
   "type": "object",
   "description": "A loose idea on the ideas board. Short. Can be turned into a shoot later.",
   "required": [
    "text"
   ],
   "properties": {
    "id": {
     "$ref": "#/$defs/Id"
    },
    "text": {
     "type": "string",
     "minLength": 1,
     "maxLength": 600,
     "description": "One idea, a sentence or two."
    },
    "project": {
     "$ref": "#/$defs/ProjectRef"
    },
    "projects": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "$ref": "#/$defs/ProjectRef"
     }
    },
    "due": {
     "$ref": "#/$defs/DateYMD",
     "description": "Optional: gives the idea a due date, turning it into a to-do."
    },
    "done": {
     "type": "boolean",
     "default": false
    }
   },
   "additionalProperties": false
  }
 },
 "examples": [
  {
   "shootboard": 1,
   "source": "ChatGPT",
   "note": "Istanbul hans: one shoot, four posts",
   "places": [
    {
     "name": "Büyük Valide Han",
     "city": "İstanbul",
     "district": "Fatih",
     "permission": "Ask the han management on the ground floor; rooftop needs the caretaker."
    }
   ],
   "projects": [
    {
     "name": "Hanlar bölgesi",
     "type": "venue",
     "shootDate": "2026-09-20",
     "topic": "The last working hans of the old city",
     "places": [
      "Büyük Valide Han"
     ],
     "shotList": "Rooftop pan at golden hour\nCourtyard wide\nCraftsman hands close-up"
    }
   ],
   "entries": [
    {
     "date": "2026-09-27",
     "time": "19:00",
     "type": "video",
     "platform": "youtube",
     "title": "Hans of Istanbul",
     "project": "Hanlar bölgesi",
     "content": {
      "videoTitle": "The Last Working Hans of Istanbul",
      "caption": "Four centuries of trade under one roof...",
      "hashtags": "#istanbul #history #documentary"
     }
    },
    {
     "date": "2026-09-27",
     "time": "19:30",
     "type": "reels",
     "platform": "instagram",
     "title": "Hans teaser",
     "project": "Hanlar bölgesi",
     "content": {
      "shortTitle": "Rooftop of a 400-year-old han",
      "caption": "Full film on YouTube tonight."
     }
    },
    {
     "date": "2026-09-28",
     "time": "12:00",
     "type": "text_post",
     "platform": "threads",
     "title": "Hans thread",
     "project": "Hanlar bölgesi",
     "content": {
      "caption": "Three things I did not know about hans before this shoot:"
     }
    }
   ],
   "scripts": [
    {
     "title": "Hanlar bölgesi — voice-over v1",
     "text": "COLD OPEN\nRooftop, golden hour.\nNARRATOR: Four hundred years ago...",
     "project": "Hanlar bölgesi"
    }
   ],
   "ideas": [
    {
     "text": "Follow one craftsman for a full day; separate short film.",
     "project": "Hanlar bölgesi"
    }
   ]
  }
 ]
};
