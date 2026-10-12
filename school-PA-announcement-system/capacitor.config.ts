import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.school.pa',
  appName: 'School PA System',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['10.177.10.119', '*']
  }
};

export default config;
