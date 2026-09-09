const fs = require('fs');
const path = require('path');
const dir = './src/components';
const targetFiles = ['UserSettingsView.tsx', 'SettingsPricingView.tsx', 'PromotionView.tsx', 'PricingView.tsx', 'NotificationsView.tsx', 'ServiceProposalView.tsx'];
let changed = 0;
targetFiles.forEach(f => {
  const fp = path.join(dir, f);
  if(fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    const orig = content;
    // Replace absolute wrappers to adapt to right space
    content = content.replace(/z-30 w-full/g, 'md:left-64 z-30 w-full md:w-[calc(100%-16rem)]');
    
    // Some files might have fixed headers that need shifting if they are left-0 or left-1/2
    // But left-1/2 is for centered toasts, which is fine to center on screen.
    // Wait, some might have fixed headers with left-0 right-0!
    // No, I checked and they only have left-1/2 for toasts.
    // The main headers in these files seem to be sticky top-0, which is perfectly fine since the container is now constrained!
    
    if(content !== orig) {
      fs.writeFileSync(fp, content);
      changed++;
      console.log('Updated ' + f);
    }
  }
});
console.log('Total files changed: ' + changed);
