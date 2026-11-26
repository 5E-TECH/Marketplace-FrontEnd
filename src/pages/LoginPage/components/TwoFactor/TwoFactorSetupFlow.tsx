import { useState } from 'react';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { AuthLayout } from '../../../../shared/ui/AuthLayout/AuthLayout';
import type { TwoFactorLeave } from '../../model/twoFactorView';
import { LoginMethods, TwoFactorSetupSteps } from '../LoginMethods/LoginMethods';
import { ConnectApp, type EnabledTwoFactor } from './ConnectApp';
import { RecoveryCodes } from './RecoveryCodes';
import { SetupIntro } from './SetupIntro';

type Stage = { name: 'intro' } | { name: 'connect' } | { name: 'codes'; enabled: EnabledTwoFactor };

/**
 * 2FA hali ulanmagan (BE-26 `twoFactorSetupRequired`: birinchi kirish yoki superadmin tiklagan): «Avval ilovani
 * ulang» → ilovani ulash (QR, kalit, kod) → zaxira kodlar → panel. Chap blok: avval «Kirish usuli», keyin
 * «Ikkinchi kodni ulash» qadamlari (umumiy-2fa-ulash).
 */
export function TwoFactorSetupFlow({ challenge, onLeave }: { challenge: TwoFactorChallenge; onLeave: (reason: TwoFactorLeave) => void }) {
  const [stage, setStage] = useState<Stage>({ name: 'intro' });

  if (stage.name === 'intro') {
    return (
      <AuthLayout centered renderAside={(tone, brand) => <LoginMethods tone={tone} brand={brand} active="admin" />}>
        <SetupIntro challenge={challenge} onStart={() => setStage({ name: 'connect' })} onOtherAccount={() => onLeave('signOut')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout centered renderAside={(tone, brand) => <TwoFactorSetupSteps tone={tone} brand={brand} step={stage.name === 'codes' ? 'codes' : 'app'} />}>
      {stage.name === 'codes' ? (
        <RecoveryCodes challenge={challenge} enabled={stage.enabled} />
      ) : (
        <ConnectApp challenge={challenge} onLeave={onLeave} onEnabled={(enabled) => setStage({ name: 'codes', enabled })} />
      )}
    </AuthLayout>
  );
}
