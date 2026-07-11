export interface FeatureItem {
  id: number;
  tag: string;
  title: string;
  description: string;
  side: 'left' | 'right';
  icon: React.ReactNode;
}
