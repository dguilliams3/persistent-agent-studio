# PONY: Local Image Generation Reference

PONY: routes to the user's self-hosted image service when their machine is online.

## Format

```
PONY: param='value' param='value' any free text here
```

Auto-adds quality tags (score_9, etc.) and negative prompt.

## Available Parameters

| Parameter | Options |
|-----------|---------|
| `position` | missionary, mating_press, doggy, prone, cowgirl, reverse_cowgirl, standing, blowjob, titjob, handjob |
| `body_type` | petite, athletic, curvy, thicc, busty, slim |
| `hair_color` | blonde, brunette, redhead, black, white, pink, blue |
| `expression` | pleasure, ahegao, moaning, shy, seductive, loving |
| `setting` | bedroom, shower, office, hotel, outdoors, pool, beach |
| `ethnicity` | caucasian, asian, japanese, latina, ebony, indian |
| `fantasy` | nurse, maid, teacher, cheerleader, bunny_girl, catgirl |
| `aesthetic` | goth, egirl, tomboy, nerd, elegant, innocent |
| `style` | realistic (default), anime, hentai, 3d, artistic |

## Examples

```
PONY: position='cowgirl' style='anime' Tifa Lockhart, red eyes
PONY: position='doggy' body_type='curvy' expression='pleasure' setting='bedroom'
PONY: style='realistic' beautiful woman, sunset lighting
```

## Notes

- Requires the user's machine to be online and running the image service
- Free (local generation)
- Most permissive content policy
- All images compressed to ~75-120KB JPEG to fit D1 limits
