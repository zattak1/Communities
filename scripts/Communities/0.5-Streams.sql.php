<?php

function Communities_0_5_Streams()
{	
	$communityId = Users::communityId();
	
	// access for relating stuff to locations
	$types = array('Places/location', 'Places/floor', 'Places/column', 'Places/area');
	foreach ($types as $type) {
		// access for managing location streams
		Streams::saveMutable(
			$type, '', array('Websites/admins'), array('messages', 'edit', -1)
		);
		Streams::saveMutable(
			$type, '', array('Users/admins'), array('max', 'max', 'own')
		);
		Streams::saveMutable(
			$type, '', array('Users/owners'), array('max', 'max', 'manage')
		);
	}
}

Communities_0_5_Streams();