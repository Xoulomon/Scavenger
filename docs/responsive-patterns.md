# Responsive Design Patterns

## Overview

Documentation of responsive design patterns used in Scavenger frontend.

## Mobile-First Approach

### Grid Layout

```css
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 992px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
// Mobile only
<div className="fixed bottom-0 md:hidden">
  <MobileNav />
</div>

// Desktop only
<div className="hidden md:block">
  <DesktopNav />
</div>
/* Minimum touch target size */
button, a {
  min-height: 44px;
  min-width: 44px;
}
```
