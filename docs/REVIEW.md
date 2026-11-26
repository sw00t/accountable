# Review policy

Every change is reviewed against this policy before it merges. 
The reviewer reports its findings and doesn't change any code.

## Passes

Make a separate pass over every change for each of these:

- **Bugs:** the code does what it's meant to, including when something goes wrong. Check the changes between states as well as each state: a request that fails after an earlier one succeeded, a reply that arrives after the person, page or session has moved on, and a service the app calls being slow or down. Where the change adds a stand-in for another service, check it behaves like that service.
- **Security:** no secrets or personal data are exposed, and nobody can do what they should not.
- **Matches spec.md and plan.md:** the change does what the spec (`docs/spec.md` and the area files in `docs/specs/` for every area the change touches) and its own `docs/changes/<branch name>/plan.md` say, with nothing missing and nothing extra.
- **Described by spec.md:** flag any code the change adds or alters that neither `docs/spec.md` nor an area file in `docs/specs/` describes. Flag too any area file the change should have updated and didn't, and any change to the area files that leaves the index in `docs/spec.md` out of date.
- **Follows STANDARDS.md:** the change follows the coding standards in `docs/STANDARDS.md`.

## Important

An Important finding must be fixed before the change merges. 
A finding is Important if the change breaks behavior that should work, leaks data or breaks a rule in AGENTS.md.

## Nits

A nit is a small point, such as style or naming, that doesn't block the merge. 
Report at most five per review.
