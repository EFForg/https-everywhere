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

NSS.initialize = function(nssPath) {  
  var sharedLib;

  try {
    sharedLib = ctypes.open(nssPath);    
  } catch (e) {
    Components.utils.import("resource://gre/modules/Services.jsm");
    var nssFile = Services.dirsvc.get("GreD", Ci.nsILocalFile);
    nssFile.append(ctypes.libraryName("nss3"));
    sharedLib = ctypes.open(nssFile.path);
  }

  NSS.types = new Object();

  NSS.types.CERTDistNames = ctypes.StructType("CERTDistNames");

  NSS.types.SECItem = ctypes.StructType("SECItem",
  				[{'type' : ctypes.int},
                                 {'data' : ctypes.unsigned_char.ptr},
                                 {'len' : ctypes.uint32_t}]);

  NSS.types.PLArenaPool = ctypes.StructType("PLArenaPool");

  NSS.types.CERTCertificateList = ctypes.StructType("CERTCertificateList",
						    [{'certs' : NSS.types.SECItem.ptr},
                                                     {'len' : ctypes.int},
                                                     {'arena' : NSS.types.PLArenaPool.ptr}]),

  NSS.types.CERTAVA = ctypes.StructType("CERTAVA",
     				[{'type' : NSS.types.SECItem},
                                 {'value' : NSS.types.SECItem}]);

  NSS.types.CERTRDN = ctypes.StructType("CERTRDN",
  				  [{'avas' : NSS.types.CERTAVA.ptr.ptr}]);
  
  NSS.types.SECAlgorithmID = ctypes.StructType("SECAlgorithmID",
  				       [{'algorithm' : NSS.types.SECItem},
                                        {'parameters' : NSS.types.SECItem}]);

  NSS.types.CERTSignedData  = ctypes.StructType("CERTSignedData",
    				       [{'data' : NSS.types.SECItem},
                                        {'signatureAlgorithm' : NSS.types.SECAlgorithmID},
                                        {'signature' : NSS.types.SECItem}]);

  NSS.types.CERTOKDomainName = ctypes.StructType("CERTOKDomainName");

  NSS.types.NSSCertificateStr = ctypes.StructType("NSSCertificateStr");

  NSS.types.CERTAuthKeyID = ctypes.StructType("CERTAuthKeyID");

  NSS.types.CERTName  = ctypes.StructType("CERTName",
    				 [{'arena' : ctypes.voidptr_t},
                                  {'rdns' : NSS.types.CERTRDN.ptr.ptr}]);

  NSS.types.CERTValidity = ctypes.StructType("CERTValidity",
    				     [{'arena' : ctypes.voidptr_t},
                                      {'notBefore' : NSS.types.SECItem},
                                      {'notAfter' : NSS.types.SECItem}]);

  NSS.types.CERTCertExtension = ctypes.StructType("CERTCertExtension",
						  [{'id' : NSS.types.SECItem},
                                                   {'critical' : NSS.types.SECItem},
                                                   {'value' : NSS.types.SECItem}]);

  NSS.types.CERTCertDBHandle = ctypes.StructType("CERTCertDBHandle");

  NSS.types.PK11SlotInfo = ctypes.StructType("PK11SlotInfo");

  NSS.types.PK11SlotListElement = ctypes.StructType("PK11SlotListElement",
						    [{'next' : ctypes.StructType("PK11SlotListElement").ptr},
                                                     {'prev' : ctypes.StructType("PK11SlotListElement").ptr},
                                                     {'slot' : NSS.types.PK11SlotInfo.ptr},
                                                     {'refCount' : ctypes.int}]),

  NSS.types.PK11SlotList = ctypes.StructType("PK11SlotList",
					     [{'head' : NSS.types.PK11SlotListElement.ptr},
                                              {'tail' : NSS.types.PK11SlotListElement.ptr},
                                              {'lock' : ctypes.StructType("PZLock").ptr}]),

  NSS.types.SECKEYPrivateKey = ctypes.StructType("SECKEYPrivateKey",
  					 [{'arena' : NSS.types.PLArenaPool.ptr},
                                          {'keyType' : ctypes.int},
                                          {'pkcs11Slot' : NSS.types.PK11SlotInfo.ptr},
                                          {'pkcs11ID' : ctypes.unsigned_long},
                                          {'pkcs11IsTemp' : ctypes.int},
                                          {'wincx' : ctypes.voidptr_t},
                                          {'staticflags' : ctypes.int32_t}]);

  NSS.types.SECKEYPublicKey = ctypes.StructType("SECKEYPublicKey");

  NSS.types.CERTSubjectPublicKeyInfo = ctypes.StructType("CERTSubjectPublicKeyInfo",
							 [{'arena' : NSS.types.PLArenaPool.ptr},
                                                          {'algorithm' : NSS.types.SECAlgorithmID},
                                                          {'subjectPublicKey' : NSS.types.SECItem}]);

  NSS.types.CERTCertificateRequest = ctypes.StructType("CERTCertificateRequest");

  NSS.types.SEC_ASN1Template = ctypes.StructType("SEC_ASN1Template",
  					 [{'kind' : ctypes.unsigned_long},
                                          {'offset' : ctypes.unsigned_long},
                                          {'sub' : ctypes.voidptr_t},
                                          {'size' : ctypes.unsigned_int}]);
					 
  NSS.types.PK11RSAGenParams = ctypes.StructType("PK11RSAGenParams",
    					 [{'keySizeInBits' : ctypes.int}, 
                                          {'pe' : ctypes.unsigned_long}]);

  NSS.types.CERTCertTrust = ctypes.StructType("CERTCertTrust",
    				      [{'sslFlags' : ctypes.uint32_t},
                                       {'emailFlags' : ctypes.uint32_t},
                                       {'objectSigningFlags' : ctypes.uint32_t}]);

  NSS.types.CERTSubjectList = ctypes.StructType("CERTSubjectList");

  NSS.types.CERTGeneralName = ctypes.StructType("CERTGeneralName");

  NSS.types.CERTCertificate = ctypes.StructType("CERTCertificate",
    					[{'arena' : NSS.types.PLArenaPool.ptr},
                                         {'subjectName' : ctypes.char.ptr},
                                         {'issuerName' : ctypes.char.ptr},
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
                                         {'emailAddr' : ctypes.char.ptr},					 
                                         {'dbhandle' : NSS.types.CERTCertDBHandle.ptr},
                                         {'subjectKeyID' : NSS.types.SECItem},
                                         {'keyIDGenerated' : ctypes.int},
                                         {'keyUsage' : ctypes.unsigned_int},
                                         {'rawKeyUsage' : ctypes.unsigned_int},
                                         {'keyUsagePresent' : ctypes.int},
                                         {'nsCertType' : ctypes.uint32_t},
                                         {'keepSession' : ctypes.int},
                                         {'timeOK' : ctypes.int},
                                         {'domainOK' : NSS.types.CERTOKDomainName.ptr},
                                         {'isperm' : ctypes.int},
                                         {'istemp' : ctypes.int},
                                         {'nickname' : ctypes.char.ptr},
                                         {'dbnickname' : ctypes.char.ptr},
                                         {'nssCertificate' : NSS.types.NSSCertificateStr.ptr},
                                         {'trust' : NSS.types.CERTCertTrust.ptr},
                                         {'referenceCount' : ctypes.int},
                                         {'subjectList' : NSS.types.CERTSubjectList.ptr},
                                         {'authKeyID' : NSS.types.CERTAuthKeyID.ptr},
                                         {'isRoot' : ctypes.int},
                                         {'options' : ctypes.voidptr_t},
                                         {'series' : ctypes.int},
                                         {'slot' : NSS.types.PK11SlotInfo.ptr},
                                         {'pkcs11ID' : ctypes.unsigned_long},
                                         {'ownSlot' : ctypes.int}]);

  NSS.types.CERTBasicConstraints = ctypes.StructType("CERTBasicConstraints",
    					     [{'isCA': ctypes.int},
                                              {'pathLenConstraint' : ctypes.int}]);
	

  NSS.lib = {
    SEC_OID_MD5 : 3,
    SEC_OID_SHA1 : 4,
    SEC_OID_X509_KEY_USAGE : 81,
    SEC_OID_NS_CERT_EXT_COMMENT : 75,
    CKM_RSA_PKCS_KEY_PAIR_GEN : 0,
    buffer : ctypes.ArrayType(ctypes.char),
    ubuffer : ctypes.ArrayType(ctypes.unsigned_char),

    // CERT_CertificateTemplate : sharedLib.declare("CERT_CertificateTemplate",
    // 						 NSS.types.SEC_ASN1Template),

    NSS_Get_CERT_CertificateTemplate : sharedLib.declare("NSS_Get_CERT_CertificateTemplate",
							 ctypes.default_abi,
							 NSS.types.SEC_ASN1Template.ptr),

    PK11_HashBuf : sharedLib.declare("PK11_HashBuf",
    				     ctypes.default_abi,
    				     ctypes.int,
    				     ctypes.int,
    				     ctypes.unsigned_char.ptr,
    				     ctypes.unsigned_char.ptr,
    				     ctypes.int32_t),

    CERT_GetDefaultCertDB : sharedLib.declare("CERT_GetDefaultCertDB",
    					      ctypes.default_abi,
    					      NSS.types.CERTCertDBHandle.ptr),

    CERT_ChangeCertTrust : sharedLib.declare("CERT_ChangeCertTrust",
    					     ctypes.default_abi,
    					     ctypes.int32_t,
    					     NSS.types.CERTCertDBHandle.ptr,
    					     NSS.types.CERTCertificate.ptr,
    					     NSS.types.CERTCertTrust.ptr),

    CERT_FindCertByNickname : sharedLib.declare("CERT_FindCertByNickname",
    						ctypes.default_abi,
    						NSS.types.CERTCertificate.ptr,
    						NSS.types.CERTCertDBHandle.ptr,
    						ctypes.char.ptr),
    
    CERT_FindCertByDERCert : sharedLib.declare("CERT_FindCertByDERCert",
					       ctypes.default_abi,
					       NSS.types.CERTCertificate.ptr,
					       NSS.types.CERTCertDBHandle.ptr,
					       NSS.types.SECItem.ptr),

    CERT_VerifyCertNow : sharedLib.declare("CERT_VerifyCertNow",
					   ctypes.default_abi,
					   ctypes.int,
					   NSS.types.CERTCertDBHandle.ptr,
					   NSS.types.CERTCertificate.ptr,
					   ctypes.int,
					   ctypes.int,
					   ctypes.voidptr_t),

    CERT_CertChainFromCert : sharedLib.declare("CERT_CertChainFromCert",
					       ctypes.default_abi,
					       NSS.types.CERTCertificateList.ptr,
					       NSS.types.CERTCertificate.ptr,
					       ctypes.int,
					       ctypes.int),

    PK11_FindKeyByAnyCert : sharedLib.declare("PK11_FindKeyByAnyCert",
    					      ctypes.default_abi,
    					      NSS.types.SECKEYPrivateKey.ptr,
    					      NSS.types.CERTCertificate.ptr,
    					      ctypes.voidptr_t),

    PK11_GetInternalKeySlot : sharedLib.declare("PK11_GetInternalKeySlot",
    						ctypes.default_abi,
    						NSS.types.PK11SlotInfo.ptr),

    PK11_GetAllSlotsForCert : sharedLib.declare("PK11_GetAllSlotsForCert",
						ctypes.default_abi,
						NSS.types.PK11SlotList.ptr,
						NSS.types.CERTCertificate.ptr,
						ctypes.voidptr_t),

    PK11_GetTokenName : sharedLib.declare("PK11_GetTokenName",
					  ctypes.default_abi,
					  ctypes.char.ptr,
					  NSS.types.PK11SlotInfo.ptr),

    PK11_GenerateKeyPair : sharedLib.declare("PK11_GenerateKeyPair",
					     ctypes.default_abi,
					     NSS.types.SECKEYPrivateKey.ptr,
					     NSS.types.PK11SlotInfo.ptr,
					     ctypes.int,
					     NSS.types.PK11RSAGenParams.ptr,
					     NSS.types.SECKEYPublicKey.ptr.ptr,
					     ctypes.int, 
					     ctypes.int,
					     ctypes.voidptr_t),
					     
    PK11_SetPrivateKeyNickname : sharedLib.declare("PK11_SetPrivateKeyNickname",
						   ctypes.default_abi,
						   ctypes.int,
						   NSS.types.SECKEYPrivateKey.ptr,
						   ctypes.char.ptr),

    SEC_ASN1EncodeItem : sharedLib.declare("SEC_ASN1EncodeItem",
					   ctypes.default_abi,
					   NSS.types.SECItem.ptr,
					   NSS.types.PLArenaPool.ptr,
					   NSS.types.SECItem.ptr,
					   ctypes.voidptr_t,
					   NSS.types.SEC_ASN1Template.ptr),

    SEC_DerSignData : sharedLib.declare("SEC_DerSignData",
					ctypes.default_abi,
					ctypes.int,
					NSS.types.PLArenaPool.ptr,
					NSS.types.SECItem.ptr,
					ctypes.unsigned_char.ptr,
					ctypes.int,
					NSS.types.SECKEYPrivateKey.ptr,
					ctypes.int),

    SEC_GetSignatureAlgorithmOidTag : sharedLib.declare("SEC_GetSignatureAlgorithmOidTag",
							ctypes.default_abi,
							ctypes.int,
							ctypes.int,
							ctypes.int),
					  
    SECOID_SetAlgorithmID : sharedLib.declare("SECOID_SetAlgorithmID",
					      ctypes.default_abi,
					      ctypes.int,
					      NSS.types.PLArenaPool.ptr,
					      NSS.types.SECAlgorithmID.ptr,
					      ctypes.int,
					      NSS.types.SECItem.ptr),


    CERT_Hexify : sharedLib.declare("CERT_Hexify",
    				    ctypes.default_abi,
    				    ctypes.char.ptr,
    				    NSS.types.SECItem.ptr,
    				    ctypes.int),

    CERT_AsciiToName : sharedLib.declare("CERT_AsciiToName",
    					 ctypes.default_abi,
    					 NSS.types.CERTName.ptr,
    					 ctypes.char.ptr),

    SECKEY_CreateSubjectPublicKeyInfo : sharedLib.declare("SECKEY_CreateSubjectPublicKeyInfo",
    							  ctypes.default_abi,
    							  NSS.types.CERTSubjectPublicKeyInfo.ptr,
    							  NSS.types.SECKEYPublicKey.ptr),

    CERT_CreateCertificateRequest : sharedLib.declare("CERT_CreateCertificateRequest",
    						      ctypes.default_abi,
    						      NSS.types.CERTCertificateRequest.ptr,
    						      NSS.types.CERTName.ptr,
    						      NSS.types.CERTSubjectPublicKeyInfo.ptr,
    						      NSS.types.SECItem.ptr.ptr),

    CERT_CreateCertificate : sharedLib.declare("CERT_CreateCertificate",
    					       ctypes.default_abi,
    					       NSS.types.CERTCertificate.ptr,
    					       ctypes.uint32_t,
    					       NSS.types.CERTName.ptr,
    					       NSS.types.CERTValidity.ptr,
    					       NSS.types.CERTCertificateRequest.ptr),

    CERT_DestroyCertificate : sharedLib.declare("CERT_DestroyCertificate",
						ctypes.default_abi,
						ctypes.int,
						NSS.types.CERTCertificate.ptr),

    CERT_DestroyCertificateList : sharedLib.declare("CERT_DestroyCertificateList",
						    ctypes.default_abi,
						    ctypes.int,
						    NSS.types.CERTCertificateList.ptr),

    CERT_NewTempCertificate : sharedLib.declare("CERT_NewTempCertificate",
						ctypes.default_abi,
						NSS.types.CERTCertificate.ptr,
						NSS.types.CERTCertDBHandle.ptr,
						NSS.types.SECItem.ptr,
						ctypes.char.ptr,
						ctypes.int,
						ctypes.int),

    CERT_CreateValidity : sharedLib.declare("CERT_CreateValidity",
    					    ctypes.default_abi,
    					    NSS.types.CERTValidity.ptr,
    					    ctypes.int64_t,
    					    ctypes.int64_t),

    CERT_CertListFromCert : sharedLib.declare("CERT_CertListFromCert",
					      ctypes.default_abi,
					      NSS.types.CERTCertificateList.ptr,
					      NSS.types.CERTCertificate.ptr),

    CERT_StartCertExtensions : sharedLib.declare("CERT_StartCertExtensions",
    					     ctypes.default_abi,
    					     ctypes.voidptr_t,
    					     NSS.types.CERTCertificate.ptr),

    CERT_AddExtension : sharedLib.declare("CERT_AddExtension",
    					  ctypes.default_abi,
					  ctypes.int,
    					  ctypes.voidptr_t,
    					  ctypes.int,
    					  NSS.types.SECItem.ptr,
    					  ctypes.int,
    					  ctypes.int),


    CERT_EncodeBasicConstraintValue : sharedLib.declare("CERT_EncodeBasicConstraintValue",
    							ctypes.default_abi,
    							ctypes.int,
    							NSS.types.PLArenaPool.ptr,
    							NSS.types.CERTBasicConstraints.ptr,
    							NSS.types.SECItem.ptr),

    CERT_EncodeAndAddBitStrExtension : sharedLib.declare("CERT_EncodeAndAddBitStrExtension",
    							 ctypes.default_abi,
    							 ctypes.int,
    							 ctypes.voidptr_t,
    							 ctypes.int,
    							 NSS.types.SECItem.ptr,
    							 ctypes.int),

    CERT_EncodeAltNameExtension : sharedLib.declare("CERT_EncodeAltNameExtension",
    						    ctypes.default_abi,
    						    ctypes.int,
    						    NSS.types.PLArenaPool.ptr,
    						    NSS.types.CERTGeneralName.ptr,
    						    NSS.types.SECItem.ptr),

    CERT_FinishExtensions : sharedLib.declare("CERT_FinishExtensions",
    					      ctypes.default_abi,
    					      ctypes.int,
    					      ctypes.voidptr_t),
							
    CERT_ImportCerts : sharedLib.declare("CERT_ImportCerts",
    					 ctypes.default_abi,
    					 ctypes.int,
    					 NSS.types.CERTCertDBHandle.ptr,
    					 ctypes.int,
    					 ctypes.int,
    					 NSS.types.SECItem.ptr.ptr,
    					 NSS.types.CERTCertificate.ptr.ptr.ptr,
    					 ctypes.int,
    					 ctypes.int,
    					 ctypes.char.ptr),

    PORT_NewArena : sharedLib.declare("PORT_NewArena",
    				      ctypes.default_abi,
    				      NSS.types.PLArenaPool.ptr,
    				      ctypes.uint32_t),

    PORT_ArenaZAlloc : sharedLib.declare("PORT_ArenaZAlloc",
					 ctypes.default_abi,
					 ctypes.voidptr_t,
					 NSS.types.PLArenaPool.ptr,
					 ctypes.int),

    PORT_FreeArena : sharedLib.declare("PORT_FreeArena",
    				       ctypes.default_abi,
    				       ctypes.void_t,
    				       NSS.types.PLArenaPool.ptr,
    				       ctypes.int),

    CERT_GetCommonName : sharedLib.declare("CERT_GetCommonName",
    					   ctypes.default_abi,
    					   ctypes.char.ptr,
    					   NSS.types.CERTName.ptr),

    CERT_GetOrgUnitName : sharedLib.declare("CERT_GetOrgUnitName",
					    ctypes.default_abi,
					    ctypes.char.ptr,
					    NSS.types.CERTName.ptr),

    CERT_GetCertificateNames : sharedLib.declare("CERT_GetCertificateNames",
    						 ctypes.default_abi,
    						 NSS.types.CERTGeneralName.ptr,
    						 NSS.types.CERTCertificate.ptr,
    						 NSS.types.PLArenaPool.ptr),

    CERT_DecodeDERCertificate : sharedLib.declare("__CERT_DecodeDERCertificate",
                                                  ctypes.default_abi,
                                                  NSS.types.CERTCertificate.ptr,
                                                  NSS.types.SECItem.ptr,
                                                  ctypes.int,
                                                  ctypes.char.ptr),

    CERT_FindCertExtension : sharedLib.declare("CERT_FindCertExtension",
					       ctypes.default_abi,
					       ctypes.int,
					       NSS.types.CERTCertificate.ptr,
					       ctypes.int,
					       NSS.types.SECItem.ptr),
  };

};
