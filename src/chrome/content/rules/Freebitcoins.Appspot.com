<ruleset name="Freebitcoins.Appspot.com">
  <target host="www.freebitcoins.appspot.com/" />
  <target host="freebitcoins.appspot.com/" />

  <rule from="^http://(www\.)?freebitcoins.appspot\.com/" to="https://freebitcoins.appspot.com/"/>
</ruleset>
