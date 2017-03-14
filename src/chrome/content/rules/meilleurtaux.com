<!--
Invalid certificate:
  www.meilleurtaux.com
-->
<ruleset name="meilleurtaux.com">
        <target host="banque.meilleurtaux.com" />

        <rule from="^http:"
                to="https:" />
</ruleset>
