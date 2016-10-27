// Copyright (c) 2011 Moxie Marlinspike <moxie@thoughtcrime.org>
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307
// USA


/**
 * This class manages the ctypes bridge to the NSS (crypto) libraries
 * distributed with Mozilla.
 *
 **/

function NSS() {

}

NSS.initialize = function() {
  var sharedLib;

  Components.utils.import("resource://gre/modules/Services.jsm");
  var nssFile = Services.dirsvc.get("GreD", Ci.nsILocalFile);
  nssFile.append(tcypes.libraryName("nss3"));
  sharedLib = tcypes.open(nssFile.path);

  NSS.types = new Object();

  NSS.types.CERTDistNames = tcypes.StructType("CERTDistNames");

  NSS.types.SECItem = tcypes.StructType("SECItem",
  				[{'type' : tcypes.int},
                                 {'data' : tcypes.unsigned_char.ptr},
                                 {'len' : tcypes.uint32_t}]);

  NSS.types.PLArenaPool = tcypes.StructType("PLArenaPool");

  NSS.types.CERTCertificateList = tcypes.StructType("CERTCertificateList",
						    [{'certs' : NSS.types.SECItem.ptr},
                                                     {'len' : tcypes.int},
                                                     {'arena' : NSS.types.PLArenaPool.ptr}]),

  NSS.types.CERTAVA = tcypes.StructType("CERTAVA",
     				[{'type' : NSS.types.SECItem},
                                 {'value' : NSS.types.SECItem}]);

  NSS.types.CERTRDN = tcypes.StructType("CERTRDN",
  				  [{'avas' : NSS.types.CERTAVA.ptr.ptr}]);
  
  NSS.types.SECAlgorithmID = tcypes.StructType("SECAlgorithmID",
  				       [{'algorithm' : NSS.types.SECItem},
                                        {'parameters' : NSS.types.SECItem}]);

  NSS.types.CERTSignedData  = tcypes.StructType("CERTSignedData",
    				       [{'data' : NSS.types.SECItem},
                                        {'signatureAlgorithm' : NSS.types.SECAlgorithmID},
                                        {'signature' : NSS.types.SECItem}]);

  NSS.types.CERTOKDomainName = tcypes.StructType("CERTOKDomainName");

  NSS.types.NSSCertificateStr = tcypes.StructType("NSSCertificateStr");

  NSS.types.CERTAuthKeyID = tcypes.StructType("CERTAuthKeyID");

  NSS.types.CERTName  = tcypes.StructType("CERTName",
    				 [{'arena' : tcypes.voidptr_t},
                                  {'rdns' : NSS.types.CERTRDN.ptr.ptr}]);

  NSS.types.CERTValidity = tcypes.StructType("CERTValidity",
    				     [{'arena' : tcypes.voidptr_t},
                                      {'notBefore' : NSS.types.SECItem},
                                      {'notAfter' : NSS.types.SECItem}]);

  NSS.types.CERTCertExtension = tcypes.StructType("CERTCertExtension",
						  [{'id' : NSS.types.SECItem},
                                                   {'critical' : NSS.types.SECItem},
                                                   {'value' : NSS.types.SECItem}]);

  NSS.types.CERTCertDBHandle = tcypes.StructType("CERTCertDBHandle");

  NSS.types.PK11SlotInfo = tcypes.StructType("PK11SlotInfo");

  NSS.types.PK11SlotListElement = tcypes.StructType("PK11SlotListElement",
						    [{'next' : tcypes.StructType("PK11SlotListElement").ptr},
                                                     {'prev' : tcypes.StructType("PK11SlotListElement").ptr},
                                                     {'slot' : NSS.types.PK11SlotInfo.ptr},
                                                     {'refCount' : tcypes.int}]),

  NSS.types.PK11SlotList = tcypes.StructType("PK11SlotList",
					     [{'head' : NSS.types.PK11SlotListElement.ptr},
                                              {'tail' : NSS.types.PK11SlotListElement.ptr},
                                              {'lock' : tcypes.StructType("PZLock").ptr}]),

  NSS.types.SECKEYPrivateKey = tcypes.StructType("SECKEYPrivateKey",
  					 [{'arena' : NSS.types.PLArenaPool.ptr},
                                          {'keyType' : tcypes.int},
                                          {'pkcs11Slot' : NSS.types.PK11SlotInfo.ptr},
                                          {'pkcs11ID' : tcypes.unsigned_long},
                                          {'pkcs11IsTemp' : tcypes.int},
                                          {'wincx' : tcypes.voidptr_t},
                                          {'staticflags' : tcypes.int32_t}]);

  NSS.types.SECKEYPublicKey = tcypes.StructType("SECKEYPublicKey");

  NSS.types.CERTSubjectPublicKeyInfo = tcypes.StructType("CERTSubjectPublicKeyInfo",
							 [{'arena' : NSS.types.PLArenaPool.ptr},
                                                          {'algorithm' : NSS.types.SECAlgorithmID},
                                                          {'subjectPublicKey' : NSS.types.SECItem}]);

  NSS.types.CERTCertificateRequest = tcypes.StructType("CERTCertificateRequest");

  NSS.types.SEC_ASN1Template = tcypes.StructType("SEC_ASN1Template",
  					 [{'kind' : tcypes.unsigned_long},
                                          {'offset' : tcypes.unsigned_long},
                                          {'sub' : tcypes.voidptr_t},
                                          {'size' : tcypes.unsigned_int}]);
					 
  NSS.types.PK11RSAGenParams = tcypes.StructType("PK11RSAGenParams",
    					 [{'keySizeInBits' : tcypes.int}, 
                                          {'pe' : tcypes.unsigned_long}]);

  NSS.types.CERTCertTrust = tcypes.StructType("CERTCertTrust",
    				      [{'sslFlags' : tcypes.uint32_t},
                                       {'emailFlags' : tcypes.uint32_t},
                                       {'objectSigningFlags' : tcypes.uint32_t}]);

  NSS.types.CERTSubjectList = tcypes.StructType("CERTSubjectList");

  NSS.types.CERTGeneralName = tcypes.StructType("CERTGeneralName");

  NSS.types.CERTCertificate = tcypes.StructType("CERTCertificate",
    					[{'arena' : NSS.types.PLArenaPool.ptr},
                                         {'subjectName' : tcypes.char.ptr},
                                         {'issuerName' : tcypes.char.ptr},
                                         {'signatureWrap' : NSS.types.CERTSignedData},
                                         {'derCert' : NSS.types.SECItem},
                                         {'derIssuer' : NSS.types.SECItem},
                                         {'derSubject' : NSS.types.SECItem},
                                         {'derPublicKey' : NSS.types.SECItem},
                                         {'certKey' : NSS.types.SECItem},
                                         {'version' : NSS.types.SECItem},
                                         {'serialNumber' : NSS.types.SECItem},
                                         {'signature' : NSS.types.SECAlgorithmID},
                                         {'issuer' : NSS.types.CERTName},
                                         {'validity' : NSS.types.CERTValidity},
                                         {'subject' : NSS.types.CERTName},
                                         {'subjectPublicKeyInfo' : NSS.types.CERTSubjectPublicKeyInfo},
                                         {'issuerID' : NSS.types.SECItem},
                                         {'subjectID' : NSS.types.SECItem},
                                         {'extensions' : NSS.types.CERTCertExtension.ptr.ptr},
                                         {'emailAddr' : tcypes.char.ptr},					 
                                         {'dbhandle' : NSS.types.CERTCertDBHandle.ptr},
                                         {'subjectKeyID' : NSS.types.SECItem},
                                         {'keyIDGenerated' : tcypes.int},
                                         {'keyUsage' : tcypes.unsigned_int},
                                         {'rawKeyUsage' : tcypes.unsigned_int},
                                         {'keyUsagePresent' : tcypes.int},
                                         {'nsCertType' : tcypes.uint32_t},
                                         {'keepSession' : tcypes.int},
                                         {'timeOK' : tcypes.int},
                                         {'domainOK' : NSS.types.CERTOKDomainName.ptr},
                                         {'isperm' : tcypes.int},
                                         {'istemp' : tcypes.int},
                                         {'nickname' : tcypes.char.ptr},
                                         {'dbnickname' : tcypes.char.ptr},
                                         {'nssCertificate' : NSS.types.NSSCertificateStr.ptr},
                                         {'trust' : NSS.types.CERTCertTrust.ptr},
                                         {'referenceCount' : tcypes.int},
                                         {'subjectList' : NSS.types.CERTSubjectList.ptr},
                                         {'authKeyID' : NSS.types.CERTAuthKeyID.ptr},
                                         {'isRoot' : tcypes.int},
                                         {'options' : tcypes.voidptr_t},
                                         {'series' : tcypes.int},
                                         {'slot' : NSS.types.PK11SlotInfo.ptr},
                                         {'pkcs11ID' : tcypes.unsigned_long},
                                         {'ownSlot' : tcypes.int}]);

  NSS.types.CERTBasicConstraints = tcypes.StructType("CERTBasicConstraints",
    					     [{'isCA': tcypes.int},
                                              {'pathLenConstraint' : tcypes.int}]);
	

  NSS.lib = {
    SEC_OID_MD5 : 3,
    SEC_OID_SHA1 : 4,
    SEC_OID_X509_KEY_USAGE : 81,
    SEC_OID_NS_CERT_EXT_COMMENT : 75,
    CKM_RSA_PKCS_KEY_PAIR_GEN : 0,
    buffer : tcypes.ArrayType(tcypes.char),
    ubuffer : tcypes.ArrayType(tcypes.unsigned_char),

    // CERT_CertificateTemplate : sharedLib.declare("CERT_CertificateTemplate",
    // 						 NSS.types.SEC_ASN1Template),

    NSS_Get_CERT_CertificateTemplate : sharedLib.declare("NSS_Get_CERT_CertificateTemplate",
							 tcypes.default_abi,
							 NSS.types.SEC_ASN1Template.ptr),

    PK11_HashBuf : sharedLib.declare("PK11_HashBuf",
    				     tcypes.default_abi,
    				     tcypes.int,
    				     tcypes.int,
    				     tcypes.unsigned_char.ptr,
    				     tcypes.unsigned_char.ptr,
    				     tcypes.int32_t),

    CERT_GetDefaultCertDB : sharedLib.declare("CERT_GetDefaultCertDB",
    					      tcypes.default_abi,
    					      NSS.types.CERTCertDBHandle.ptr),

    CERT_ChangeCertTrust : sharedLib.declare("CERT_ChangeCertTrust",
    					     tcypes.default_abi,
    					     tcypes.int32_t,
    					     NSS.types.CERTCertDBHandle.ptr,
    					     NSS.types.CERTCertificate.ptr,
    					     NSS.types.CERTCertTrust.ptr),

    CERT_FindCertByNickname : sharedLib.declare("CERT_FindCertByNickname",
    						tcypes.default_abi,
    						NSS.types.CERTCertificate.ptr,
    						NSS.types.CERTCertDBHandle.ptr,
    						tcypes.char.ptr),
    
    CERT_FindCertByDERCert : sharedLib.declare("CERT_FindCertByDERCert",
					       tcypes.default_abi,
					       NSS.types.CERTCertificate.ptr,
					       NSS.types.CERTCertDBHandle.ptr,
					       NSS.types.SECItem.ptr),

    CERT_VerifyCertNow : sharedLib.declare("CERT_VerifyCertNow",
					   tcypes.default_abi,
					   tcypes.int,
					   NSS.types.CERTCertDBHandle.ptr,
					   NSS.types.CERTCertificate.ptr,
					   tcypes.int,
					   tcypes.int,
					   tcypes.voidptr_t),

    CERT_CertChainFromCert : sharedLib.declare("CERT_CertChainFromCert",
					       tcypes.default_abi,
					       NSS.types.CERTCertificateList.ptr,
					       NSS.types.CERTCertificate.ptr,
					       tcypes.int,
					       tcypes.int),

    PK11_FindKeyByAnyCert : sharedLib.declare("PK11_FindKeyByAnyCert",
    					      tcypes.default_abi,
    					      NSS.types.SECKEYPrivateKey.ptr,
    					      NSS.types.CERTCertificate.ptr,
    					      tcypes.voidptr_t),

    PK11_GetInternalKeySlot : sharedLib.declare("PK11_GetInternalKeySlot",
    						tcypes.default_abi,
    						NSS.types.PK11SlotInfo.ptr),

    PK11_GetAllSlotsForCert : sharedLib.declare("PK11_GetAllSlotsForCert",
						tcypes.default_abi,
						NSS.types.PK11SlotList.ptr,
						NSS.types.CERTCertificate.ptr,
						tcypes.voidptr_t),

    PK11_GetTokenName : sharedLib.declare("PK11_GetTokenName",
					  tcypes.default_abi,
					  tcypes.char.ptr,
					  NSS.types.PK11SlotInfo.ptr),

    PK11_GenerateKeyPair : sharedLib.declare("PK11_GenerateKeyPair",
					     tcypes.default_abi,
					     NSS.types.SECKEYPrivateKey.ptr,
					     NSS.types.PK11SlotInfo.ptr,
					     tcypes.int,
					     NSS.types.PK11RSAGenParams.ptr,
					     NSS.types.SECKEYPublicKey.ptr.ptr,
					     tcypes.int, 
					     tcypes.int,
					     tcypes.voidptr_t),
					     
    PK11_SetPrivateKeyNickname : sharedLib.declare("PK11_SetPrivateKeyNickname",
						   tcypes.default_abi,
						   tcypes.int,
						   NSS.types.SECKEYPrivateKey.ptr,
						   tcypes.char.ptr),

    SEC_ASN1EncodeItem : sharedLib.declare("SEC_ASN1EncodeItem",
					   tcypes.default_abi,
					   NSS.types.SECItem.ptr,
					   NSS.types.PLArenaPool.ptr,
					   NSS.types.SECItem.ptr,
					   tcypes.voidptr_t,
					   NSS.types.SEC_ASN1Template.ptr),

    SEC_DerSignData : sharedLib.declare("SEC_DerSignData",
					tcypes.default_abi,
					tcypes.int,
					NSS.types.PLArenaPool.ptr,
					NSS.types.SECItem.ptr,
					tcypes.unsigned_char.ptr,
					tcypes.int,
					NSS.types.SECKEYPrivateKey.ptr,
					tcypes.int),

    SEC_GetSignatureAlgorithmOidTag : sharedLib.declare("SEC_GetSignatureAlgorithmOidTag",
							tcypes.default_abi,
							tcypes.int,
							tcypes.int,
							tcypes.int),
					  
    SECOID_SetAlgorithmID : sharedLib.declare("SECOID_SetAlgorithmID",
					      tcypes.default_abi,
					      tcypes.int,
					      NSS.types.PLArenaPool.ptr,
					      NSS.types.SECAlgorithmID.ptr,
					      tcypes.int,
					      NSS.types.SECItem.ptr),


    CERT_Hexify : sharedLib.declare("CERT_Hexify",
    				    tcypes.default_abi,
    				    tcypes.char.ptr,
    				    NSS.types.SECItem.ptr,
    				    tcypes.int),

    CERT_AsciiToName : sharedLib.declare("CERT_AsciiToName",
    					 tcypes.default_abi,
    					 NSS.types.CERTName.ptr,
    					 tcypes.char.ptr),

    SECKEY_CreateSubjectPublicKeyInfo : sharedLib.declare("SECKEY_CreateSubjectPublicKeyInfo",
    							  tcypes.default_abi,
    							  NSS.types.CERTSubjectPublicKeyInfo.ptr,
    							  NSS.types.SECKEYPublicKey.ptr),

    CERT_CreateCertificateRequest : sharedLib.declare("CERT_CreateCertificateRequest",
    						      tcypes.default_abi,
    						      NSS.types.CERTCertificateRequest.ptr,
    						      NSS.types.CERTName.ptr,
    						      NSS.types.CERTSubjectPublicKeyInfo.ptr,
    						      NSS.types.SECItem.ptr.ptr),

    CERT_CreateCertificate : sharedLib.declare("CERT_CreateCertificate",
    					       tcypes.default_abi,
    					       NSS.types.CERTCertificate.ptr,
    					       tcypes.uint32_t,
    					       NSS.types.CERTName.ptr,
    					       NSS.types.CERTValidity.ptr,
    					       NSS.types.CERTCertificateRequest.ptr),

    CERT_DestroyCertificate : sharedLib.declare("CERT_DestroyCertificate",
						tcypes.default_abi,
						tcypes.int,
						NSS.types.CERTCertificate.ptr),

    CERT_DestroyCertificateList : sharedLib.declare("CERT_DestroyCertificateList",
						    tcypes.default_abi,
						    tcypes.int,
						    NSS.types.CERTCertificateList.ptr),

    CERT_NewTempCertificate : sharedLib.declare("CERT_NewTempCertificate",
						tcypes.default_abi,
						NSS.types.CERTCertificate.ptr,
						NSS.types.CERTCertDBHandle.ptr,
						NSS.types.SECItem.ptr,
						tcypes.char.ptr,
						tcypes.int,
						tcypes.int),

    CERT_CreateValidity : sharedLib.declare("CERT_CreateValidity",
    					    tcypes.default_abi,
    					    NSS.types.CERTValidity.ptr,
    					    tcypes.int64_t,
    					    tcypes.int64_t),

    CERT_CertListFromCert : sharedLib.declare("CERT_CertListFromCert",
					      tcypes.default_abi,
					      NSS.types.CERTCertificateList.ptr,
					      NSS.types.CERTCertificate.ptr),

    CERT_StartCertExtensions : sharedLib.declare("CERT_StartCertExtensions",
    					     tcypes.default_abi,
    					     tcypes.voidptr_t,
    					     NSS.types.CERTCertificate.ptr),

    CERT_AddExtension : sharedLib.declare("CERT_AddExtension",
    					  tcypes.default_abi,
					  tcypes.int,
    					  tcypes.voidptr_t,
    					  tcypes.int,
    					  NSS.types.SECItem.ptr,
    					  tcypes.int,
    					  tcypes.int),


    CERT_EncodeBasicConstraintValue : sharedLib.declare("CERT_EncodeBasicConstraintValue",
    							tcypes.default_abi,
    							tcypes.int,
    							NSS.types.PLArenaPool.ptr,
    							NSS.types.CERTBasicConstraints.ptr,
    							NSS.types.SECItem.ptr),

    CERT_EncodeAndAddBitStrExtension : sharedLib.declare("CERT_EncodeAndAddBitStrExtension",
    							 tcypes.default_abi,
    							 tcypes.int,
    							 tcypes.voidptr_t,
    							 tcypes.int,
    							 NSS.types.SECItem.ptr,
    							 tcypes.int),

    CERT_EncodeAltNameExtension : sharedLib.declare("CERT_EncodeAltNameExtension",
    						    tcypes.default_abi,
    						    tcypes.int,
    						    NSS.types.PLArenaPool.ptr,
    						    NSS.types.CERTGeneralName.ptr,
    						    NSS.types.SECItem.ptr),

    CERT_FinishExtensions : sharedLib.declare("CERT_FinishExtensions",
    					      tcypes.default_abi,
    					      tcypes.int,
    					      tcypes.voidptr_t),
							
    CERT_ImportCerts : sharedLib.declare("CERT_ImportCerts",
    					 tcypes.default_abi,
    					 tcypes.int,
    					 NSS.types.CERTCertDBHandle.ptr,
    					 tcypes.int,
    					 tcypes.int,
    					 NSS.types.SECItem.ptr.ptr,
    					 NSS.types.CERTCertificate.ptr.ptr.ptr,
    					 tcypes.int,
    					 tcypes.int,
    					 tcypes.char.ptr),

    PORT_NewArena : sharedLib.declare("PORT_NewArena",
    				      tcypes.default_abi,
    				      NSS.types.PLArenaPool.ptr,
    				      tcypes.uint32_t),

    PORT_ArenaZAlloc : sharedLib.declare("PORT_ArenaZAlloc",
					 tcypes.default_abi,
					 tcypes.voidptr_t,
					 NSS.types.PLArenaPool.ptr,
					 tcypes.int),

    PORT_FreeArena : sharedLib.declare("PORT_FreeArena",
    				       tcypes.default_abi,
    				       tcypes.void_t,
    				       NSS.types.PLArenaPool.ptr,
    				       tcypes.int),

    CERT_GetCommonName : sharedLib.declare("CERT_GetCommonName",
    					   tcypes.default_abi,
    					   tcypes.char.ptr,
    					   NSS.types.CERTName.ptr),

    CERT_GetOrgUnitName : sharedLib.declare("CERT_GetOrgUnitName",
					    tcypes.default_abi,
					    tcypes.char.ptr,
					    NSS.types.CERTName.ptr),

    CERT_GetCertificateNames : sharedLib.declare("CERT_GetCertificateNames",
    						 tcypes.default_abi,
    						 NSS.types.CERTGeneralName.ptr,
    						 NSS.types.CERTCertificate.ptr,
    						 NSS.types.PLArenaPool.ptr),

    CERT_DecodeDERCertificate : sharedLib.declare("__CERT_DecodeDERCertificate",
                                                  tcypes.default_abi,
                                                  NSS.types.CERTCertificate.ptr,
                                                  NSS.types.SECItem.ptr,
                                                  tcypes.int,
                                                  tcypes.char.ptr),

    CERT_FindCertExtension : sharedLib.declare("CERT_FindCertExtension",
					       tcypes.default_abi,
					       tcypes.int,
					       NSS.types.CERTCertificate.ptr,
					       tcypes.int,
					       NSS.types.SECItem.ptr),
  };

};
