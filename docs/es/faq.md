## Preguntas Frecuentes sobre "HTTPS Everywhere"

Esta página responde a las preguntas más frecuentes sobre el proyecto de la EFF
[HTTPS Everywhere](https://www.eff.org/https-everywhere) "HTTPS en todos
lados". Si no encuentra la respuesta a su pregunta, puede intentar con los
recursos [enumerados aquí](https://www.eff.org/https-everywhere/development).

*   [¿Qué pasa si HTTPS Everywhere rompe algún sitio que
    uso?](#what-if-https-everywhere-breaks-some-site-that-i-use)
*   [¿Por qué HTTPS Everywhere me impide unirme a la red del hotel/escuela u
    otra red
    inalámbrica?](#why-is-https-everywhere-preventing-me-from-joining-this-hotelschoolother-wireless-network)
*   [¿Habrá una versión de HTTPS Everywhere para IE, Safari o algún otro
    navegador?](#will-there-be-a-version-of-https-everywhere-for-ie-safari-or-some-other-browser)
*   [¿Por qué utilizar una lista blanca de sitios que admiten HTTPS? ¿Por qué
    no pueden intentar utilizar HTTPS para cada sitio, y sólo volver a HTTP si
    no está
    disponible?](#why-use-a-whitelist-of-sites-that-support-https-why-cant-you-try-to-use-https-for-every-last-site-and-only-fall-back-to-http-if-it-isnt-available)
*   [¿Cómo puedo eliminar o mover el botón HTTPS Everywhere de la barra de
    herramientas?](#how-do-i-get-rid-ofmove-the-https-everywhere-button-in-the-toolbar)
*   [¿Cuándo me protege HTTPS Everywhere? ¿Cuándo no me
    protege?](#when-does-https-everywhere-protect-me-when-does-it-not-protect-me)
*   [¿De qué me protege HTTPS
    Everywhere?](#what-does-https-everywhere-protect-me-against)
*   [¿Cómo obtengo soporte para un sitio adicional en HTTPS
    Everywhere?](#how-do-i-get-support-for-an-additional-site-in-https-everywhere)
*   [¿Qué pasa si el sitio no admite HTTPS, o si sólo lo admite para algunas
    actividades, como introducir información de la tarjeta de
    crédito?](#what-if-the-site-doesnt-support-https-or-only-supports-it-for-some-activities-like-entering-credit-card-information)
*   [¿No es más caro o lento para un sitio usar HTTPS en comparación con HTTP
    normal?](#isnt-it-more-expensive-or-slower-for-a-site-to-support-https-compared-to-regular-http)
*   [¿Por qué debría usar HTTPS Everywhere en lugar de simplemente teclear
    https:// al principio del nombre de un
    sitio?](#why-should-i-use-https-everywhere-instead-of-just-typing-https-at-the-beginning-of-site-names)
*   [¿Por qué HTTPS Everywhere incluye reglas para sitios como PayPal que ya
    requieren HTTPS en todas sus
    páginas?](#why-does-https-everywhere-include-rules-for-sites-like-paypal-that-already-require-https-on-all-their-pages)
*   [¿Qué significan los diferentes colores de las reglas en el menú de la
    barra de herramientas en
    Firefox?](#what-do-the-different-colors-for-rulesets-in-the-firefox-toolbar-menu-mean)
*   [¿Qué significan los diferentes colores del icono de HTTPS
    Everywhere?](#what-do-the-different-colors-of-the-https-everywhere-icon-mean)
*   [Tengo un problema al instalar la extensión del
    navegador.](#im-having-a-problem-installing-the-browser-extension.)
*   [¿Cómo desinstalo/elimino HTTPS
    Everywhere?](#how-do-i-uninstallremove-https-everywhere)
*   [¿Cómo agrego mi propio sitio a HTTPS
    Everywhere?](#how-do-i-add-my-own-site-to-https-everywhere)
*   [¿Puedo ayudar a traducir HTTPS Everywhere a mi propio
    idioma?](#can-i-help-translate-https-everywhere-into-my-own-language)

### [¿Qué pasa si HTTPS Everywhere rompe algún sitio que uso?](#what-if-https-everywhere-breaks-some-site-that-i-use)

Esto es ocasionalmente posible debido al soporte inconsistente de HTTPS en
sitios (por ejemplo, cuando un sitio parece soportar HTTPS pero hace algunas
partes del sitio, imprededicibles, indisponibles por medio de HTTPS). Si nos
[informa del problema](https://github.com/EFForg/https-everywhere/issues),
podemos intentar solucionarlo. Mientras tanto, puede desactivar la regla que
afecta a ese sitio en particular en su propia copia de HTTPS Everywhere
haciendo clic en el botón de la barra de herramientas HTTPS Everywhere y
desmarcando la regla para ese sitio.

También puede informar el problema al sitio, ya que ellos tienen el poder para
solucionarlo!

### [¿Por qué HTTPS Everywhere me impide unirme a la red del hotel/escuela u otra red inalámbrica?](#why-is-https-everywhere-preventing-me-from-joining-this-hotelschoolother-wireless-network)

Algunas redes inalámbricas secuestran sus conexiones HTTP cuando se une por
primera vez a ellas, con el fin de exigir su autenticación o simplemente
intentar hacer que acepte los términos de uso. Las páginas HTTPS están
protegidas contra este tipo de secuestro, que es como debería ser. Si va a un
sitio web que no está protegido por HTTPS Everywhere o por HSTS (actualmente,
example.com es uno de esos sitios), permitirá que su conexión sea capturada y
redirigida a la página de autenticación o términos de uso.

### [¿Habrá una versión de HTTPS Everywhere para IE, Safari o algún otro navegador?](#will-there-be-a-version-of-https-everywhere-for-ie-safari-or-some-other-browser)

A principios de 2012, la API para extensiones de Safari no ofrece una forma de
realizar la reescritura segura de las solicitudes HTTP a HTTPS. Pero si por
casualidad conoce una forma de realizar la reescritura segura de solicitudes en
estos navegadores, no dude en hacérnoslo saber en https-everywhere en EFF.org
(pero tenga en cuenta que modificar document.location o window.location en
JavaScript no es seguro).

### [¿Por qué utilizar una lista blanca de sitios que admiten HTTPS? ¿Por qué no pueden intentar utilizar HTTPS para cada sitio, y sólo volver a HTTP si no está disponible?](#why-use-a-whitelist-of-sites-that-support-https-why-cant-you-try-to-use-https-for-every-last-site-and-only-fall-back-to-http-if-it-isnt-available)

Hay varios problemas con la idea de tratar de detectar automáticamente HTTPS en
cada sitio. No hay ninguna garantía de que los sitios van a dar la misma
respuesta a través de HTTPS que a través de HTTP. Además, no es posible probar
HTTPS en tiempo real sin introducir vulnerabilidades de seguridad (¿Qué debería
hacer la extensión si falla el intento de conexión por HTTPS? Volver a un HTTP
inseguro no es seguro). Y en algunos casos, HTTPS Everywhere tiene que llevar a
cabo transformaciones bastante complicadas en URIs - por ejemplo, hasta
recientemente la regla de Wikipedia tenía que convertir una dirección como
`http://en.wikipedia.org/wiki/World_Wide_Web` en
`https://secure.wikimedia.org/wikipedia/en/wiki/World_Wide_Web` por que HTTPS
no estaba disponible en los dominios habituales de Wikipedia.

### [¿Cómo puedo eliminar o mover el botón HTTPS Everywhere de la barra de herramientas?](#how-do-i-get-rid-ofmove-the-https-everywhere-button-in-the-toolbar)

El botón HTTPS Everywhere es útil porque le permite ver y desactivar un
conjunto de reglas si causa problemas con un sitio. Pero si prefiere
desactivarla, vaya a Ver->Barras de herramientas->Personalizar y arrastre el
botón fuera de la barra de herramientas y dentro en la barra de complementos en
la parte inferior de la página. Después, puede ocultar la barra de
complementos. (En teoría, debería poder arrastrarlo a la bandeja de iconos
disponibles también, pero eso puede desencadenar [este
error](https://trac.torproject.org/projects/tor/ticket/6276).

### [¿Cuándo me protege HTTPS Everywhere? ¿Cuándo no me protege?](#when-does-https-everywhere-protect-me-when-does-it-not-protect-me)

HTTPS Everywhere lo protege sólo cuando está utilizando _porciones cifradas de
sitios web soportados_. En un sitio soportado, se activará automáticamente el
cifrado HTTPS para todas las partes soportadas conocidas del sitio (para
algunos sitios, esto podría ser sólo una parte de todo el sitio). Por ejemplo,
si su proveedor de correo web no admite HTTPS en absoluto, HTTPS Everywhere no
puede hacer que su acceso a su correo web sea seguro. Del mismo modo, si un
sitio permite HTTPS para texto pero no para imágenes, es posible que alguien
vea las imágenes que cargue el navegador y adivine a qué está accediendo.

HTTPS Everywhere depende completamente de las características de seguridad de
los sitios web individuales que utilice; _Activa_ estas funciones de seguridad,
pero no las puede _crear_ si no existen. Si utiliza un sitio no no soportado
por HTTPS Everywhere o un sitio que proporciona cierta información de forma
insegura, HTTPS Everywhere no puede proporcionar protección adicional para su
uso de ese sitio. Por favor recuerde verificar que la seguridad de un sitio en
particular está funcionando al nivel que usted espera antes de enviar o recibir
información confidencial, incluyendo contraseñas.

Una forma de determinar el nivel de protección que obtendrá al utilizar un
sitio en particular es utilizar una herramienta de análisis de paquetes como
[Wireshark] (https://www.wireshark.org/) para registrar sus propias
comunicaciones con el sitio. La vista resultante de sus comunicaciones es
aproximadamente igual a lo que un escucha secreto vería en su red wifi o en su
ISP. De esta manera, puede determinar si algunas o todas sus comunicaciones
estarían protegidas; Sin embargo, puede tomar bastante tiempo hacer sentido a
la vista de Wireshark con suficiente cuidado para obtener una respuesta
definitiva.

También puede activar la función "Bloquear todas las solicitudes HTTP" para
obtener mayor protección. En lugar de cargar páginas o imágenes inseguras,
HTTPS Everywhere las bloqueará completamente.

### [¿De qué me protege HTTPS Everywhere?](#what-does-https-everywhere-protect-me-against)

En las partes compatibles de los sitios admitidos, HTTPS Everywhere habilita la
protección HTTPS de los sitios, lo que le puede proteger contra la escucha y la
manipulación indebida del contenido del sitio o de la información que envía al
sitio. Idealmente, esto proporciona cierta protección contra un atacante que
aprende el contenido de la información que fluye en ambos sentidos - por
ejemplo, el texto de los mensajes de correo electrónico que envía o recibe a
través de un sitio de webmail, los productos que navega o compra en un comercio
electrónico Sitio o los artículos particulares que lea en un sitio de
referencia.

Sin embargo, HTTPS Everywhere **no oculta las identidades de los sitios a los
que accede**, la cantidad de tiempo que pasa con ellos ni la cantidad de
información que carga o descarga desde un sitio en particular. Por ejemplo, si
accede a `http://www.eff.org/issues/nsa-spying` y HTTPS Everywhere vuelve a
escribirlo como `https://www.eff.org/issues/nsa-spying`, un espía todavía puede
reconocer de forma trivial que está accediendo a www.eff.org (pero puede que no
sepa qué tema está leyendo). En general, toda la parte del nombre de dominio de
una URL permanece expuesta al intruso, ya que ésta debe enviarse repetidamente
en forma no cifrada durante el establecimiento de la conexión. Otra forma de
decirlo es que HTTPS nunca fue diseñado para ocultar la identidad de los sitios
que visita.

Investigadores también han demostrado que es posible que alguien pueda
averiguar más acerca de lo que está haciendo en un sitio simplemente a través
de una cuidadosa observación de la cantidad de datos que sube y descarga, o los
patrones de tiempo de su uso del sitio. Un ejemplo simple es que si el sitio
sólo tiene una página de cierto tamaño total, cualquier persona que descargue
exactamente esa cantidad de datos del sitio probablemente está accediendo a esa
página.

Si desea protegerse contra el monitoreo de los sitios que visita, considere
usar HTTPS Everywhere junto con software como
[Tor](https://www.torproject.org/).

### [¿Cómo obtengo soporte para un sitio adicional en HTTPS Everywhere?](#how-do-i-get-support-for-an-additional-site-in-https-everywhere)

Puede aprender [como escribir
reglas](https://www.eff.org/https-everywhere/rulesets) que enseñan a HTTPS
Everywhere a soportar nuevos sitios. Puede instalar estas reglas en su propio
navegador o enviárnoslas para su posible inclusión en la versión oficial.

### [¿Qué pasa si el sitio no admite HTTPS, o si sólo lo admite para algunas actividades, como introducir información de la tarjeta de crédito?](#what-if-the-site-doesnt-support-https-or-only-supports-it-for-some-activities-like-entering-credit-card-information)

Podría tratar de ponerse en contacto con el sitio y señalar que el uso de HTTPS
para todas las características del sitio es una práctica cada vez más común hoy
en día y protege a los usuarios (y sitios) contra una variedad de ataques de
Internet. Por ejemplo, le defiende contra la capacidad de otras personas en una
red inalámbrica de espiar su uso del sitio o incluso tomar control de su
cuenta. También puede señalar que los números de tarjetas de crédito no son la
única información que usted considera privada o sensible.

Sitios como Google, Twitter y Facebook ahora soportan HTTPS para información no
financiera, por razones de privacidad y seguridad general.

### [¿No es más caro o lento para un sitio usar HTTPS en comparación con HTTP normal?](#isnt-it-more-expensive-or-slower-for-a-site-to-support-https-compared-to-regular-http)

Puede ser, pero algunos sitios han sido gratamente sorprendidos al ver lo
práctico que puede ser. Además, los expertos de Google están actualmente
implementando varias mejoras en el protocolo TLS que hacen HTTPS dramáticamente
más rápido; si estas mejoras se añaden a la norma pronto, la brecha de
velocidad entre los dos debería casi desaparecer. Ver [la descripción de Adam
Langley de la situación de la implementación de
HTTPS](https://www.imperialviolet.org/2010/06/25/overclocking-ssl.html) para
más detalles sobre esta cuestión. En particular, Langley afirma: "Para
[habilitar HTTPS de forma predeterminada para Gmail] no tuvimos que desplegar
máquinas adicionales ni hardware especial. En nuestras máquinas frontend de
producción, SSL/TLS representa menos del 1% de la carga del CPU, menos de 10KB
de memoria por conexión y menos del 2% de la sobrecarga de red".

Solía ser caro comprar un certificado para el uso de HTTPS, pero ahora se puede
obtener de forma gratuita en [Let's Encrypt](https://letsencrypt.org/) de igual
manera.

### [¿Por qué debría usar HTTPS Everywhere en lugar de simplemente teclear https:// al principio del nombre de un sitio?](#why-should-i-use-https-everywhere-instead-of-just-typing-https-at-the-beginning-of-site-names)

Incluso si normalmente escribe https://, HTTPS Everywhere podría protegerlo si
alguna vez lo olvida. Además, puede reescribir los enlaces que siga de otras
personas. Por ejemplo, si hace clic en un enlace a
`http://en.wikipedia.org/wiki/EFF_Pioneer_Award`, HTTPS Everywhere volverá a
escribir el enlace de forma automática como
`https://en.wikimedia.org/wikipedia/en/wiki/EFF_Pioneer_Award`. Por lo tanto,
puede obtener alguna protección incluso si no hubiera notado que el sitio de
destino está disponible en HTTPS.

### [¿Por qué HTTPS Everywhere incluye reglas para sitios como PayPal que ya requieren HTTPS en todas sus páginas?](#why-does-https-everywhere-include-rules-for-sites-like-paypal-that-already-require-https-on-all-their-pages)

HTTPS Everywhere, como la [especificación
HSTS](https://en.wikipedia.org/wiki/HTTP_Strict_Transport_Security), trata de
abordar un ataque llamado [SSL
stripping](https://moxie.org/software/sslstrip/). Los usuarios sólo están
protegidos contra un ataque "SSL stripping" si sus navegadores ni siquiera
_intentan_ conectarse a la versión HTTP del sitio, incluso si el sitio los
hubiera redirigido a la versión HTTPS. Con HTTPS Everywhere, el navegador ni
siquiera intenta la conexión HTTP insegura, incluso si eso es lo que usted le
pide que haga. (Tenga en cuenta que actualmente HTTPS Everywhere no incluye una
lista completa de dichos sitios, que son principalmente instituciones
financieras).

### [¿Qué significan los diferentes colores de las reglas en el menú de la barra de herramientas en Firefox?](#what-do-the-different-colors-for-rulesets-in-the-firefox-toolbar-menu-mean)

Los colores son:

Verde oscuro: el conjunto de reglas estaba activa durante la carga de recursos
en la página actual.

Verde claro: el conjunto de reglas estaba listo para evitar las cargas HTTP en
la página actual, pero todo lo que el conjunto de reglas habría cubierto se
cargó a través de HTTPS de todos modos (en el código, verde claro se le llama
una "regla discutible").

Marrón oscuro o Flecha roja en el sentido de las agujas del reloj: regla rota
-- el conjunto de reglas está activo, pero el servidor está redirigiendo al
menos algunas direcciones URL de HTTPS a HTTP.

Gris: el conjunto de reglas está deshabilitado.

### [¿Qué significan los diferentes colores del icono de HTTPS Everywhere?](#what-do-the-different-colors-of-the-https-everywhere-icon-mean)

Los colores son:

Azul claro: HTTPS Everywhere está habilitado.

Azul oscuro: HTTPS Everywhere está habilitado y activo para cargar recursos en
la página actual.

Rojo: Todas las peticiones sin cifrar serán bloqueadas por HTTPS Everywhere.

Gris: HTTPS Everywhere está deshabilitado.

### [Tengo un problema al instalar la extensión del navegador.](#im-having-a-problem-installing-the-browser-extension.)

Algunas personas informan que la instalación de HTTPS Everywhere les da el
error: "El complemento no se pudo descargar debido a un error de conexión en
www.eff.org". Esto puede ser causado por el antivirus Avast, que bloquea la
instalación de extensiones de navegador. Puede que pueda [instalarlo desde
addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/https-everywhere/).

### [¿Cómo desinstalo/elimino HTTPS Everywhere?](#how-do-i-uninstallremove-https-everywhere)

En Firefox: Haga clic en el botón de menú en la parte superior derecha de la
ventana al final de la barra de herramientas (aparece como tres líneas
horizontales) y, a continuación, haga clic en "Complementos" (parece una pieza
de rompecabezas). Desplácese hasta que vea HTTPS Everywhere y a continuación
haga clic en el botón "Eliminar" que se encuentra completamente a la derecha.
Al finalizar, puede cerrar la ventana de complementos.

En Chrome: haga clic en el botón de menú situado en la parte superior derecha
de la ventana al final de la barra de herramientas (aparece como tres líneas
horizontales) y, a continuación, haz clic en "Configuración" cerca de la parte
inferior. A la izquierda, haga clic en "Extensiones". Desplácese hasta que vea
HTTPS Everywhere y a continuación, haga clic en el icono de la papelera de la
derecha y haga clic en "Eliminar" para confirmar la eliminación. Al finalizar,
puede cerrar la ventana de configuración.

### [¿Cómo agrego mi propio sitio a HTTPS Everywhere?](#how-do-i-add-my-own-site-to-https-everywhere)

Estamos contentos de que desee que su sitio en HTTPS Everywhere! Sin embargo,
recuerde que no todos los que visitan su sitio tienen instalada nuestra
extensión. Si administra un sitio web, puede configurarlo para que use de forma
predeterminada HTTPS para todos, no solo para los usuarios de HTTPS Everywhere.
Y es menos trabajo! Los pasos que usted debe tomar, en orden, son:

1.  Configure un
    [redireccionamiento](https://www.sslshopper.com/apache-redirect-http-to-https.html)
    de HTTP a HTTPS en su sitio.
2.  [Agregue el header "Strict-Transport-Security" (HSTS) en su
    sitio.](https://raymii.org/s/tutorials/HTTP_Strict_Transport_Security_for_Apache_NGINX_and_Lighttpd.html)
3.  [Agregue su sitio a la lista de precarga de
    HSTS.](https://hstspreload.appspot.com/)

Estos pasos le darán a su sitio una protección mucho mejor que añadirlo a HTTPS
Everywhere. En términos generales, una vez que haya terminado, no es necesario
agregar su sitio a HTTPS Everywhere. Sin embargo, si lo aún desea, siga las
[instrucciones sobre escribir conjuntos de
reglas](https://eff.org/https-everywhere/rulesets), e indique que usted es el
autor del sitio cuando solicite un "pull request".

### [¿Puedo ayudar a traducir HTTPS Everywhere a mi propio idioma? ](#can-i-help-translate-https-everywhere-into-my-own-language)

¡Sí! Utilizamos la cuenta Transifex de Tor Project para las traducciones, por
favor inscríbase para ayudar a traducir en
[https://www.transifex.com/otf/torproject](https://www.transifex.com/otf/torproject).
