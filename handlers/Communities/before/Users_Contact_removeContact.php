<?php

function Communities_before_Users_Contact_removeContact($params, &$result)
{
	$userId = $params['userId'];
	$label = $params['label'];
	$skipAccess = Q::ifset($params, 'skipAccess', false);

	if ($skipAccess) {
		$result = true;
		return;
	}
	
	$asUserId = Q::ifset($params, "asUserId", null) ?: Users::loggedInUser(true)->id;

	if (!Users::isCommunityId($userId)) {
		$result = true;
	}

	// skipAccess, because this read *computes* the authorization decision --
	// it is not a read on the caller's behalf. Its sibling
	// Users_Contact_addContact.php already passes it; this one relies on
	// Users_Contact::fetch skipping its check whenever no label is given,
	// which is itself a bug (PR opened on Qbix/Users).
	$contacts = Users_Contact::fetch($userId, null, array(
		'contactUserId' => $asUserId,
		'skipAccess' => true
	));
	foreach ($contacts as $contact) {
		if (Users_Label::canRevokeLabel($contact->label, $label, false)) {
			$result = true;
		}
	}
}