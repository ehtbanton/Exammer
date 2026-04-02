import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, MessageSquare, Bot } from 'lucide-react';
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';
import { Progress } from '@/components/ui/progress';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex flex-col items-center pt-12 pb-8 px-4">
        <Link href="/workspace" className="flex flex-col items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity">
          <Image
            src="/exammer.png"
            alt="Exammer Logo"
            width={160}
            height={160}
            className="h-40 w-40 object-contain"
          />

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl font-bold font-headline text-primary">
              Exammer
            </h1>
            <p className="text-xl text-muted-foreground">
              Aprende con inteligencia
            </p>
          </div>
        </Link>

        {/* RAG for RAG Subheading */}
        {/* <div className="mt-8 flex items-start gap-6 text-2xl font-mono leading-tight">
          <div className="flex gap-4">
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-gray-500">R</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">t</span>
              <span className="text-gray-400">r</span>
              <span className="text-gray-400">i</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">v</span>
              <span className="text-gray-400">a</span>
              <span className="text-gray-400">l</span>
            </div>
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-gray-500">A</span>
              <span className="text-gray-400">u</span>
              <span className="text-gray-400">g</span>
              <span className="text-gray-400">m</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">n</span>
              <span className="text-gray-400">t</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">d</span>
            </div>
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-gray-500">G</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">n</span>
              <span className="text-gray-400">e</span>
              <span className="text-gray-400">r</span>
              <span className="text-gray-400">a</span>
              <span className="text-gray-400">t</span>
              <span className="text-gray-400">i</span>
              <span className="text-gray-400">o</span>
              <span className="text-gray-400">n</span>
            </div>
          </div>

          <div className="flex items-start pt-0">
            <span className="text-muted-foreground italic text-lg">for</span>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-red-500">R</span>
              <span className="text-red-400">e</span>
              <span className="text-red-400">d</span>
            </div>
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-amber-500">A</span>
              <span className="text-amber-400">m</span>
              <span className="text-amber-400">b</span>
              <span className="text-amber-400">e</span>
              <span className="text-amber-400">r</span>
            </div>
            <div className="flex flex-col leading-[1.1]">
              <span className="font-extrabold text-green-500">G</span>
              <span className="text-green-400">r</span>
              <span className="text-green-400">e</span>
              <span className="text-green-400">e</span>
              <span className="text-green-400">n</span>
            </div>
          </div>
        </div> */}

        {/* Product Description */}
        <p className="mt-6 max-w-4xl text-center text-3xl text-muted-foreground px-4 leading-snug">
          Exammer es una plataforma de IA que convierte tus documentos en un plan de aprendizaje estructurado,
          con un tutor interactivo y seguimiento gamificado para reemplazar la improvisación con claridad.
        </p>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">

        <div className="grid md:grid-cols-2 gap-8">
          {/* The Workspace */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <CardTitle>El Espacio de Trabajo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Tu centro de aprendizaje personal donde todos los cursos y temas están organizados.
              </p>
              <div className="grid grid-cols-1 gap-3 mb-4">
                {/* Subject Card 1 */}
                <Card className="hover:shadow-md transition-shadow border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 font-headline text-base">
                      <BookOpen className="text-primary h-5 w-5" />
                      Mathematics A-Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">4 módulos identificados.</p>
                  </CardContent>
                </Card>
                {/* Subject Card 2 */}
                <Card className="hover:shadow-md transition-shadow border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 font-headline text-base">
                      <BookOpen className="text-primary h-5 w-5" />
                      Physics AS-Level
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">3 módulos identificados.</p>
                  </CardContent>
                </Card>
              </div>
              {/* Bullet points */}
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Todo tu aprendizaje en un solo lugar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Busca y agrega nuevos cursos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Sigue tu progreso en todos los temas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Compite con tus compañeros en las clases</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Levels of Understanding */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="[&>div>div:last-child]:hidden">
                  <UnderstandingIndicator percentage={75} size="lg" />
                </div>
                <CardTitle>Niveles de Comprensión</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Cada pregunta, tema y módulo se clasifica según tu nivel de comprensión, ayudándote a enfocarte en lo que necesitas mejorar.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {/* Green with few questions completed */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#4ade80', borderColor: '#22c55e'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Trigonometry Basics</span>
                    <UnderstandingIndicator percentage={95} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">3/10 attempted</p>
                  <Progress value={30} className="h-1.5 mt-2" />
                </div>
                {/* Yellow/Amber with all completed */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#fbbf24', borderColor: '#f59e0b'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Statistics & Probability</span>
                    <UnderstandingIndicator percentage={72} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">6/6 attempted</p>
                  <Progress value={100} className="h-1.5 mt-2" />
                </div>
                {/* Red with partial completion */}
                <div className="border-2 rounded-lg p-3" style={{backgroundColor: '#f87171', borderColor: '#dc2626'}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-black">Calculus Integration</span>
                    <UnderstandingIndicator percentage={38} size="sm" />
                  </div>
                  <p className="text-xs text-black mt-1">5/12 attempted</p>
                  <Progress value={42} className="h-1.5 mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classrooms */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <CardTitle>Aulas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Comparte tu progreso, compara niveles de comprensión, identifica áreas débiles y trabaja en equipo hacia el éxito.
              </p>
              <div className="space-y-3">
                {/* Classroom Card Example */}
                <div className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Year 12 Maths</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>24 estudiantes</span>
                    <span>Código: ABC123</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Promedio de la clase</div>
                  <div className="w-full bg-muted rounded-full h-2 mb-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '68%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">68% comprensión</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Xam - The AI Tutor */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <CardTitle>Xam - Tu Tutor de IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Conoce a Xam, tu tutor personal de IA. Recibe retroalimentación instantánea, pistas y orientación mientras
                trabajas en las preguntas. Xam da seguimiento a tus objetivos y te ayuda a dominar cada tema paso a paso.
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-2">
                {/* User Message */}
                <div className="flex gap-2 justify-end">
                  <div className="bg-primary text-primary-foreground rounded-lg p-2 text-xs max-w-[80%]">
                    Obtuve x = 5, ¿es correcto?
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">U</div>
                </div>
                {/* Xam's Response */}
                <div className="flex gap-2">
                  <Bot className="w-6 h-6 text-primary shrink-0" />
                  <div className="bg-secondary text-secondary-foreground rounded-lg p-2 text-xs">
                    ¡Excelente trabajo! Has resuelto correctamente x = 5. ¡Objetivo 3 completado! Ahora intenta sustituir este valor en la ecuación original para verificar.
                  </div>
                </div>
                {/* Objectives Progress */}
                <div className="flex items-center gap-2 text-xs pt-1">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-muted-foreground">3/4 objetivos</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto px-4 py-12 text-center">
        <h3 className="text-2xl font-bold mb-4">¿Listo para transformar tu aprendizaje?</h3>
        <Link href="/auth/signin">
          <Button size="lg" variant="default" className="text-lg px-8 py-6">
            Iniciar Sesión
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
