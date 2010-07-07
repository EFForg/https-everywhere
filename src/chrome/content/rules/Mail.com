<ruleset name="Mail.com">
       <rule from="^http://mail\.com/" to="https://www.mail.com/"/>
       <rule from="^http://www\.mail\.com/" to="https://www.mail.com/"/>
</ruleset>

