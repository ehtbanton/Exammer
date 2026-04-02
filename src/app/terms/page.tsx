import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Inicio
        </Button>
      </Link>

      <h1 className="text-4xl font-bold mb-2">Términos de Servicio</h1>
      <p className="text-muted-foreground mb-8">Última actualización: 19 de noviembre de 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">Aceptación de los Términos</h2>
          <p className="text-muted-foreground">
            Al acceder o usar Exammer, aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no podrás usar nuestro servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Descripción del Servicio</h2>
          <p className="text-muted-foreground">
            Exammer es una herramienta de preparación de exámenes impulsada por inteligencia artificial que ayuda a los estudiantes a organizar materiales de estudio, practicar con preguntas de exámenes anteriores y dar seguimiento a su comprensión de los temas. El servicio incluye retroalimentación generada por IA, seguimiento de progreso y funciones colaborativas de aula.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Registro de Cuenta</h2>
          <p className="text-muted-foreground mb-3">
            Para usar Exammer, debes:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Proporcionar información de registro precisa y completa</li>
            <li>Mantener la seguridad de tu contraseña</li>
            <li>Tener al menos 13 años de edad (o contar con el consentimiento de tus padres)</li>
            <li>No compartir tu cuenta con otras personas</li>
            <li>Notificarnos de inmediato sobre cualquier acceso no autorizado</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            Eres responsable de todas las actividades que ocurran en tu cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Uso Aceptable</h2>
          <p className="text-muted-foreground mb-3">Aceptas NO:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Usar el servicio para cualquier propósito ilegal</li>
            <li>Intentar obtener acceso no autorizado a nuestros sistemas</li>
            <li>Subir código malicioso, virus o contenido dañino</li>
            <li>Acosar, abusar o dañar a otros usuarios</li>
            <li>Extraer, copiar o redistribuir nuestro contenido sin permiso</li>
            <li>Usar el servicio para hacer trampa en exámenes o violar políticas de integridad académica</li>
            <li>Realizar ingeniería inversa o intentar extraer el código fuente</li>
            <li>Sobrecargar nuestros servidores o interferir con la operación del servicio</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contenido del Usuario</h2>
          <p className="text-muted-foreground mb-3">
            Conservas la propiedad del contenido que subes a Exammer. Sin embargo, nos otorgas una licencia para:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Almacenar y procesar tu contenido para proporcionar el servicio</li>
            <li>Usar tu contenido para entrenar y mejorar las funciones de IA (de forma anónima)</li>
            <li>Mostrar tu contenido a otros usuarios en aulas compartidas</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            Eres responsable de asegurarte de que tienes el derecho de subir cualquier contenido y de que no infringe la propiedad intelectual de terceros.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contenido Generado por IA</h2>
          <p className="text-muted-foreground">
            Exammer utiliza inteligencia artificial para generar materiales de estudio y retroalimentación. El contenido generado por IA se proporciona "tal cual" y puede contener errores. Debes verificar la información importante de forma independiente. No somos responsables de las decisiones tomadas con base en contenido generado por IA.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Pagos y Reembolsos</h2>
          <p className="text-muted-foreground">
            Los pagos se procesan de forma segura a través de Stripe. Todas las tarifas no son reembolsables excepto cuando la ley lo requiera. Nos reservamos el derecho de cambiar los precios con aviso razonable.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Propiedad Intelectual</h2>
          <p className="text-muted-foreground">
            El servicio de Exammer, incluyendo su diseño, funciones y marca, es de nuestra propiedad y está protegido por derechos de autor y otras leyes de propiedad intelectual. No puedes copiar, modificar ni crear obras derivadas sin permiso.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Disponibilidad del Servicio</h2>
          <p className="text-muted-foreground">
            Nos esforzamos por mantener Exammer disponible las 24 horas del día, los 7 días de la semana, pero no garantizamos acceso ininterrumpido. Podemos modificar, suspender o descontinuar cualquier parte del servicio en cualquier momento sin previo aviso.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Terminación</h2>
          <p className="text-muted-foreground">
            Podemos cancelar o suspender tu cuenta de inmediato si violas estos Términos. Puedes eliminar tu cuenta en cualquier momento. Al momento de la terminación, tu derecho a usar el servicio cesa, pero ciertas disposiciones (como los derechos de propiedad intelectual) permanecen vigentes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Exención de Garantías</h2>
          <p className="text-muted-foreground">
            EXAMMER SE PROPORCIONA "TAL CUAL" SIN GARANTÍAS DE NINGÚN TIPO. No garantizamos que el servicio cumpla con tus requisitos, esté libre de errores ni que el contenido generado por IA sea preciso. Úsalo bajo tu propio riesgo.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Limitación de Responsabilidad</h2>
          <p className="text-muted-foreground">
            En la máxima medida permitida por la ley, Exammer no será responsable de ningún daño indirecto, incidental, especial o consecuente derivado de tu uso del servicio. Nuestra responsabilidad total no excederá la cantidad que nos hayas pagado en los últimos 12 meses.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Ley Aplicable</h2>
          <p className="text-muted-foreground">
            Estos Términos se rigen por las leyes de Inglaterra y Gales. Cualquier disputa se resolverá en los tribunales de Inglaterra y Gales.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cambios a los Términos</h2>
          <p className="text-muted-foreground">
            Podemos actualizar estos Términos en cualquier momento. Los cambios significativos se notificarán por correo electrónico o a través del servicio. El uso continuado después de los cambios constituye la aceptación de los nuevos términos.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contacto</h2>
          <p className="text-muted-foreground">
            Para preguntas sobre estos Términos, contacta:<br />
            <a href="mailto:anton.may@new.ox.ac.uk" className="text-primary hover:underline">anton.may@new.ox.ac.uk</a><br />
            New College, Oxford, OX1 3BN, United Kingdom
          </p>
        </section>
      </div>
    </div>
  );
}
