# VFA.Gallery
## An Online Gallery for Emerging Visual Fine Artists
### URL: https://vfa.gallery
### Developer: Sam Corl <samcorl@gmail.com>

**It MUST be fun!**
The desired experience is light-hearted and fun. Pop in, make an account, set a fun avatar and create a gallery, collection and upload some artwork. Share the URL with friends and have them give feedback directly. **No toxic online drive-by comment section BS**.

**MOBILE-FIRST** 
Most traffic is expected to be on mobile devices

**Minimalist, modern design**
Simple and elegant, let the art speak for itself 

**Live edit goodness**
In the style of modern apps, most operations will be atomic, with state changes handled by React.

**Reliable deep-links and URL-based state management** URLs should be safe for bookmarking and sharing - the app should use React router or similar to maintain state. 

**URL format is (slugs):** ARTIST / GALLERY / COLLECTION / ARTWORK 

**Optimized for comics and manga** 
An emerging genre of manga and anime is empowering young artists to be prolific and creative. The primary goal of this application is to support emerging artists by providing dead-simple SaaS online gallery services. 

**Do NOT reinvent the wheel** 
Do NOT be clever. There's nothing "groundbreaking" about this, we need it to be a reliable, simple, beautiful and configurable app for visual fine artists. 

## Monetization
- Ad-supported, free for artists
- Ads placed near footer, below content - minimal intrusion
- No premium tiers planned initially

## Technology Stack
- React (latest stable)
- Typescript
- CloudFlare D1 Database
- CloudFlare R2 for image storage
- Hosted on CloudFlare pages - no persistent hosting
- SSO with Google and/or Apple - I do NOT want to manage user login issues
- Deploy with GitHub actions
- Developed with agent assistance 
  - Front-end expert skill
  - preference for reusable ruby scripts for super-admin tasks

## Administrator UI
- Deactivate / Reactivate User Profiles
- Adjust limits for Galleries, Collections, Artworks
- Direct Message with Users
- Only most trusted users are admins
- Users "own" most of their own stuff, so this should be rarely used

## Admin Developer scripts
- For managing users, groups, galleries, etc. 
- Ruby or Node / Typescript is preferred, in that order

## User Profile UI
- Auto-activated after email verification + CAPTCHA
- Rate limits on new accounts (e.g., 10 uploads/day initially)
- Auto-flag suspicious activity (rapid uploads, duplicates)
- Edit User Details
- Direct Message with Administrators
- View summary and link to filtered and paginated list of
  - Galleries (limited to 500)
  - Collections (limited to 1,000)
  - Artworks (limited to 5,000)

## Administrator / User Messages UI
- Activate / Deactivate User Profiles
- Direct Message with Administrators


## Galleries
### Similar to a physical gallery
- Gallery Welcome
- Featured Collection promos
- Gallery "map" (aka sitemap in our case)
- Info Desk (natural language search)
- Galleries can be managed by users with a role assigned
- Gallery slugs are unique within an artist's scope
- Full URL format: `/artist-slug/gallery-slug/collection-slug/artwork-slug`
- Example: `/sam-corl/emerging-manga-in-the-deep-deep-south/winter-2025/dragon-01`
- Default "my-gallery" and "my-collection" for private testing
- Themed -- a theme can be selected

### Gallery User Roles
- Creator gets "Gallery Creator" role
- Admins get "Gallery Admin" role
- Only creators can add or remove admins


## Collections
- Collection Welcome (hero image)
- Themed -- a theme can be selected

### Edit / Arrange Collection
- Choose layout style from pre-defined "themes"
- Set background color
- Change the sequence of the art in the collection
- Add art to the collection
- Remove art from the collection

### New Collection Form
- "Active" users can create collections
- Copying from another of their collections is supported



## Themes
- System-configured starter pack (read-only)
- Themes can be copied or created by users
- Themes can be designated "public" for sharing with other users
- Theme for artwork is designated directly or "inherited" with this order of preference: artwork, collection, artist, gallery
- Themes provide consistent styling within galleries, collections and artist profiles


## Artwork

### Browse:
- Featured Artists
- Date Artwork is Posted
- Artist Name (fuzzy match with autocomplete)
- Category

### Search by:
- Featured Artists
- Date Artwork is Posted
- Artist Name, Artwork Name, Description (fuzzy match with autocomplete)
- Category


## Artist Bios and Contact Info
- Name
- Group / Organization / Company
- Website
- Email
- Phone
- Socials
- Logo / Avatar

## Group / Org / Company Info
- Name
- Website
- Email
- Phone
- Socials
- Members
- Logo / Avatar
- Public group page at `/groups/group-slug` showing members and their galleries


### New Artwork Uploads
- "Active" users can create artwork, including description, details, etc.
- Image Upload and camera supported
- Image size is limited to 5MB (?)
- Auto-generate display version, thumbnail and icon assets
- Watermark display version with artist username (not email)
- No edit, only create
- When collections are managed, images can be replaced with newer versions. But artwork cannot be over-written, to prevent accidents

### Manage Artwork
- Edit description, date (or portion thereof), materials, etc.
- Deactivate / Reactivate

## Artist Feedback
### Direct Messages
- Handled by user-to-user messaging feature
- Messages can be designated as regarding an artist, gallery, collection or artwork (or all of the above)
- not visible to the public - to avoid comparison
- scored for tone and checked for foul language
- comments are put into "pending review" status if they are at all suspect
- Admins will approve or deny comments in "pending review" status
- Primary scoring should be with non-LLM tools to avoid token burn
- Only usernames are visible - only Admins know the email address of users
- Primarily negative comments are not appropriate on this platform

### "Likes"
- absolutely none of this. Physical galleries don't rate their artists and neither will we

## Content Policy
- No Terms of Service or AUP yet - TBD
- Will host any legal content
- Zero tolerance for abuse or illegal activity
- Image moderation approach TBD

### Social Media sharing
- Make it easy to share any page on socials
  - Insta
  - FB
  - etc.

