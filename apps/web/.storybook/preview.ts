import type { Preview } from '@storybook/react-vite';

// Import Tailwind CSS styles
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'hsl(222.2 84% 4.9%)' },
        { name: 'light', value: 'hsl(0 0% 100%)' },
      ],
    },
  },
};

export default preview;
