import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </Link>

      <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: November 19, 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">Agreement to Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using Exammer, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Description of Service</h2>
          <p className="text-muted-foreground">
            Exammer is an AI-powered exam preparation tool that helps students organize study materials, practice past exam questions, and track their understanding across topics. The service includes AI-generated feedback, progress tracking, and collaborative classroom features.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Account Registration</h2>
          <p className="text-muted-foreground mb-3">
            To use Exammer, you must:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your password</li>
            <li>Be at least 13 years old (or have parental consent)</li>
            <li>Not share your account with others</li>
            <li>Notify us immediately of any unauthorized access</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            You are responsible for all activities that occur under your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Acceptable Use</h2>
          <p className="text-muted-foreground mb-3">You agree NOT to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Use the service for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Upload malicious code, viruses, or harmful content</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Scrape, copy, or redistribute our content without permission</li>
            <li>Use the service to cheat on exams or violate academic integrity policies</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Overwhelm our servers or interfere with service operation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">User Content</h2>
          <p className="text-muted-foreground mb-3">
            You retain ownership of content you upload to Exammer. However, you grant us a license to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Store and process your content to provide the service</li>
            <li>Use your content to train and improve AI features (anonymized)</li>
            <li>Display your content to other users in shared classrooms</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            You are responsible for ensuring you have the right to upload any content and that it doesn't infringe on others' intellectual property.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">AI-Generated Content</h2>
          <p className="text-muted-foreground">
            Exammer uses artificial intelligence to generate study materials and feedback. AI-generated content is provided "as is" and may contain errors. You should verify important information independently. We are not responsible for decisions made based on AI-generated content.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Payments and Refunds</h2>
          <p className="text-muted-foreground">
            Payments are processed securely through Stripe. All fees are non-refundable except as required by law. We reserve the right to change pricing with reasonable notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Intellectual Property</h2>
          <p className="text-muted-foreground">
            The Exammer service, including its design, features, and branding, is owned by us and protected by copyright and other intellectual property laws. You may not copy, modify, or create derivative works without permission.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Service Availability</h2>
          <p className="text-muted-foreground">
            We strive to keep Exammer available 24/7, but we do not guarantee uninterrupted access. We may modify, suspend, or discontinue any part of the service at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Termination</h2>
          <p className="text-muted-foreground">
            We may terminate or suspend your account immediately if you violate these Terms. You may delete your account at any time. Upon termination, your right to use the service ceases, but certain provisions (like intellectual property rights) survive.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Disclaimer of Warranties</h2>
          <p className="text-muted-foreground">
            EXAMMER IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. We do not guarantee that the service will meet your requirements, be error-free, or that AI-generated content will be accurate. Use at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the fullest extent permitted by law, Exammer shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid us in the past 12 months.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Changes to Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms at any time. Significant changes will be notified by email or through the service. Continued use after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contact</h2>
          <p className="text-muted-foreground">
            For questions about these Terms, contact:<br />
            <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a><br />
            New College, Oxford, OX1 3BN, United Kingdom
          </p>
        </section>
      </div>
    </div>
  );
}
