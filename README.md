# Fdroid Data Search

Raw text searching for Fdroiddata pipelines is disabled.

![](./screenshot-gitlab.png)

This script searches through them using the Gitlab API.

![](./screenshot-search.png)

# Usage

```sh
git clone https://github.com/brandonp2412/F-droid-data-search fdroiddata-search
cd fdroiddata-search
bun install
bun search.ts flexify
```

Package ids also work, and look up every pipeline that touched the app's
metadata file directly (no page limit needed):

```sh
bun search.ts com.presley.flexify
```

# Optional args

Pass limit to go beyond 99 pages of the pipelines:

```sh
bun search.ts Notally 999
```
