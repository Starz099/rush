import FeatureSection from '@/components/feature';
import Hero from '@/components/hero';
import Showcase from '@/components/showcase';
import FaqSection from '@/components/faq';
import CtaSection from '@/components/cta';

const Home = () => {
  return (
    <div className="mt-16 flex w-full flex-col items-center gap-24">
      <Hero />
      <Showcase />
      <FeatureSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
};

export default Home;
