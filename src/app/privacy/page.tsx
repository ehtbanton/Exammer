'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Inicio
        </Button>
      </Link>

      <h1 className="text-4xl font-bold mb-2">Política de Privacidad</h1>
      <p className="text-muted-foreground mb-8">Última actualización: 19 de noviembre de 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">Introducción</h2>
          <p className="text-muted-foreground">
            Exammer ("nosotros", "nuestro", "nos") opera la aplicación web Exammer. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos tu información personal cuando utilizas nuestro servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Información que Recopilamos</h2>
          <h3 className="text-xl font-semibold mb-2 mt-4">Información de la Cuenta</h3>
          <p className="text-muted-foreground mb-3">
            Cuando creas una cuenta, recopilamos:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Dirección de correo electrónico</li>
            <li>Contraseña (encriptada)</li>
            <li>Nombre para mostrar (si se proporciona)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-2 mt-4">Datos de Estudio</h3>
          <p className="text-muted-foreground mb-3">
            Mientras usas Exammer, almacenamos:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Tus preguntas, respuestas y materiales de estudio</li>
            <li>Seguimiento de progreso y métricas de rendimiento</li>
            <li>Cursos, temas y materiales de capacitación con los que trabajas</li>
            <li>Interacciones con el tutor de IA (Xam)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-2 mt-4">Información Técnica</h3>
          <p className="text-muted-foreground mb-3">
            Recopilamos automáticamente:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Tipo y versión del navegador</li>
            <li>Información del dispositivo</li>
            <li>Dirección IP y datos de ubicación</li>
            <li>Datos de uso y analítica</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cómo Usamos Tu Información</h2>
          <p className="text-muted-foreground mb-3">Usamos tus datos para:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Proporcionar y mantener el servicio de Exammer</li>
            <li>Generar materiales de estudio y retroalimentación con inteligencia artificial</li>
            <li>Dar seguimiento a tu progreso de aprendizaje y niveles de comprensión</li>
            <li>Habilitar funciones de aula y comparaciones entre compañeros</li>
            <li>Procesar pagos y donaciones</li>
            <li>Enviar notificaciones relacionadas con el servicio</li>
            <li>Mejorar nuestro servicio y desarrollar nuevas funciones</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Servicios de Terceros</h2>
          <p className="text-muted-foreground mb-3">
            Utilizamos los siguientes servicios de terceros que pueden procesar tus datos:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><strong>Proveedores de IA</strong> - Tu contenido de estudio es procesado por servicios de IA para generar preguntas, retroalimentación y tutoría</li>
            <li><strong>Firebase</strong> - Para autenticación e infraestructura de alojamiento</li>
            <li><strong>Stripe</strong> - Para procesamiento de pagos (aplica la política de privacidad de Stripe)</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            Estos servicios tienen sus propias políticas de privacidad y pueden recopilar datos de forma independiente.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Almacenamiento y Seguridad de Datos</h2>
          <p className="text-muted-foreground">
            Tus datos se almacenan de forma segura utilizando encriptación estándar de la industria. Implementamos medidas técnicas y organizativas apropiadas para proteger tu información personal. Sin embargo, ningún método de transmisión por internet es 100% seguro.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Tus Derechos</h2>
          <p className="text-muted-foreground mb-3">Tienes derecho a:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Acceder a tus datos personales</li>
            <li>Corregir datos inexactos</li>
            <li>Solicitar la eliminación de tu cuenta y datos</li>
            <li>Exportar tus datos</li>
            <li>Oponerte al procesamiento de datos</li>
            <li>Retirar tu consentimiento en cualquier momento</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            Para ejercer estos derechos, contáctanos en <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cookies</h2>
          <p className="text-muted-foreground mb-3">
            Usamos cookies para que Exammer funcione y para mejorar tu experiencia. Las cookies se clasifican en:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1 mb-3">
            <li><strong>Esenciales:</strong> Necesarias para la autenticación y funcionalidad básica (no se pueden desactivar)</li>
            <li><strong>Funcionales:</strong> Recuerdan tus preferencias como la configuración del tema</li>
            <li><strong>Analíticas:</strong> Nos ayudan a entender cómo usas el sitio (opcionales)</li>
            <li><strong>Marketing:</strong> Muestran anuncios relevantes (opcionales, actualmente no se utilizan)</li>
          </ul>
          <p className="text-muted-foreground">
            Puedes gestionar tus preferencias de cookies en cualquier momento a través de nuestra{' '}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('show-cookie-banner'))}
              className="text-primary hover:underline"
            >
              Preferencias de Cookies
            </button>
            {' '}configuración. Desactivar las cookies esenciales te impedirá usar Exammer.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Privacidad de Menores</h2>
          <p className="text-muted-foreground">
            Exammer está dirigido a estudiantes de todas las edades. Si eres menor de 16 años, por favor obtén el consentimiento de tus padres antes de usar nuestro servicio. Los padres pueden solicitar la eliminación de los datos de sus hijos contactándonos.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cambios a Esta Política</h2>
          <p className="text-muted-foreground">
            Podemos actualizar esta Política de Privacidad de vez en cuando. Te notificaremos de cambios significativos por correo electrónico o a través del servicio. El uso continuado después de los cambios constituye aceptación.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contáctanos</h2>
          <p className="text-muted-foreground">
            Para dudas o preguntas sobre privacidad, contacta:<br />
            <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a><br />
            New College, Oxford, OX1 3BN, United Kingdom
          </p>
        </section>
      </div>
    </div>
  );
}
