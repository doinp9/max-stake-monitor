# Privacy Policy — Max Stake Monitor

## Data Collection

This extension **does not collect, transmit, or share any user data**. Period.

## What the extension accesses

- **HTTP responses** in your browser tab — the extension reads API responses that your browser already receives. It does not make any additional network requests.
- **`chrome.storage.local`** — used to store your max stake log (up to 500 entries) and language preference. This data lives entirely on your local machine and is never transmitted anywhere.

## What the extension does NOT do

- ❌ Does not send data to any external server
- ❌ Does not collect personal information
- ❌ Does not track browsing history
- ❌ Does not use analytics or telemetry
- ❌ Does not inject ads
- ❌ Does not modify or automate any actions on websites
- ❌ Does not access any data outside the bookmaker tab

## Permissions explained

| Permission | Why it's needed |
| --- | --- |
| `storage` | Save your max stake log and language preference locally |
| `activeTab` | Show the overlay on the current bookmaker tab |
| `host_permissions` | Run the interceptor script on bookmaker pages to read API responses |

## Data deletion

All stored data can be cleared at any time by clicking the **Clear** button in the extension popup, or by uninstalling the extension.

## Contact

If you have questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/doinp9/max-stake-monitor).
