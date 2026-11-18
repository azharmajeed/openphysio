# UI1a contrast (WCAG ratio, text threshold 4.5:1)

Generated from tokens.json by the test maths (OKLCH to sRGB to relative luminance).

| pair | light | dark |
|---|---|---|
| foreground on background | 18.01 | 18.44 |
| card-foreground on card | 18.80 | 16.93 |
| popover-foreground on popover | 18.80 | 16.93 |
| primary-foreground on primary | 4.56 | 8.25 |
| secondary-foreground on secondary | 13.82 | 14.66 |
| accent-foreground on accent | 13.82 | 14.66 |
| muted-foreground on background | 5.74 | 7.54 |
| muted-foreground on card | 5.99 | 6.92 |
| good on background | 4.90 | 9.32 |
| watch on background | 4.94 | 10.60 |
| stop on background | 4.58 | 6.37 |
| good on card | 5.11 | 8.55 |
| watch on card | 5.16 | 9.73 |
| stop on card | 4.78 | 5.84 |

Values changed to pass (light mode only; dark passed unchanged):

| token | before | ratio on background (before) | after | ratio (after) |
|---|---|---|---|---|
| good | oklch(0.6 0.16 150) | 3.53 | oklch(0.52 0.15 150) | 4.90 |
| watch | oklch(0.72 0.16 75) | 2.43 | oklch(0.54 0.13 75) | 4.94 |

Session-type colours (new, replaces the hex list) are held to the 3:1 non-text rule on background and card in both modes.
