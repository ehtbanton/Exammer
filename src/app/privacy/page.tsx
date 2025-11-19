import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </Link>

      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: November 19, 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">Introduction</h2>
          <p className="text-muted-foreground">
            Exammer ("we", "our", "us") operates the Exammer web application. This Privacy Policy explains how we collect, use, and protect your personal information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
          <h3 className="text-xl font-semibold mb-2 mt-4">Account Information</h3>
          <p className="text-muted-foreground mb-3">
            When you create an account, we collect:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Email address</li>
            <li>Password (encrypted)</li>
            <li>Display name (if provided)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-2 mt-4">Study Data</h3>
          <p className="text-muted-foreground mb-3">
            As you use Exammer, we store:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Your questions, answers, and study materials</li>
            <li>Progress tracking and performance metrics</li>
            <li>Subjects, topics, and exam papers you work with</li>
            <li>Interactions with the AI tutor (Xam)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-2 mt-4">Technical Information</h3>
          <p className="text-muted-foreground mb-3">
            We automatically collect:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>IP address and location data</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">How We Use Your Information</h2>
          <p className="text-muted-foreground mb-3">We use your data to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Provide and maintain the Exammer service</li>
            <li>Generate AI-powered study materials and feedback</li>
            <li>Track your learning progress and understanding levels</li>
            <li>Enable classroom features and peer comparisons</li>
            <li>Process payments and donations</li>
            <li>Send service-related notifications</li>
            <li>Improve our service and develop new features</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Third-Party Services</h2>
          <p className="text-muted-foreground mb-3">
            We use the following third-party services that may process your data:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><strong>AI Providers</strong> - Your study content is processed by AI services to generate questions, feedback, and tutoring</li>
            <li><strong>Firebase</strong> - For authentication and hosting infrastructure</li>
            <li><strong>Stripe</strong> - For payment processing (Stripe's privacy policy applies)</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            These services have their own privacy policies and may collect data independently.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Data Storage and Security</h2>
          <p className="text-muted-foreground">
            Your data is stored securely using industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Your Rights</h2>
          <p className="text-muted-foreground mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Export your data</li>
            <li>Object to data processing</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            To exercise these rights, contact us at <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cookies</h2>
          <p className="text-muted-foreground">
            We use essential cookies for authentication and session management. You can manage cookie preferences through our cookie consent banner. Disabling essential cookies may prevent you from using certain features.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Children's Privacy</h2>
          <p className="text-muted-foreground">
            Exammer is intended for students of all ages. If you are under 16, please obtain parental consent before using our service. Parents may request deletion of their child's data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through the service. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
          <p className="text-muted-foreground">
            For privacy concerns or questions, contact:<br />
            <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a><br />
            New College, Oxford, OX1 3BN, United Kingdom
          </p>
        </section>
      </div>
    </div>
  );
}
