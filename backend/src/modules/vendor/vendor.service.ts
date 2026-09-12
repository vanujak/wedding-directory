import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { VendorEntity } from 'src/database/entities/vendor.entity';
import { DataSource } from 'typeorm';
import { VendorRepository } from '../../database/repositories/vendor.repository';
import { CreateVendorInput } from '../../graphql/inputs/createVendor.input';
import * as bcrypt from 'bcryptjs';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { VendorRepositoryType } from 'src/database/types/vendorTypes';
import { UpdateVendorInput } from 'src/graphql/inputs/updateVendor.input';

@Injectable()
export class VendorService {
  private vendorRepository: VendorRepositoryType;

  constructor(
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
  ) {
    this.vendorRepository = VendorRepository(this.dataSource);
  }

  async autocompleteLocation(input: string): Promise<string[]> {
    if (!input || !input.trim()) return [];

    try {
      // 1. Primary: Use OpenStreetMap Nominatim (Free, no billing or API key required)
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        input.trim()
      )}&format=json&addressdetails=1&limit=6&countrycodes=lk`;

      const osmResponse = await firstValueFrom(
        this.httpService.get(osmUrl, {
          headers: {
            'User-Agent': 'SayIDo-WeddingDirectory/1.0 (contact: sayidolk@gmail.com)',
            'Accept-Language': 'en',
          },
        })
      );

      if (Array.isArray(osmResponse.data) && osmResponse.data.length > 0) {
        return osmResponse.data.map((item: any) => item.display_name);
      }
    } catch (osmError) {
      console.warn('Nominatim autocomplete error, checking Google Places fallback:', osmError?.message);
    }

    // 2. Fallback to Google Places if configured and working
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&components=country:lk&key=${apiKey}`;

        const response = await firstValueFrom(this.httpService.get(url));
        if (response.data?.predictions && response.data.predictions.length > 0) {
          return response.data.predictions.map((p: any) => p.description);
        }
      }
    } catch (gError) {
      console.warn('Google Places autocomplete fallback failed:', gError?.message);
    }

    return [];
  }

  async findAllVendors(): Promise<VendorEntity[]> {
    return this.vendorRepository.findAllVendors();
  }

  async findVendorById(id: string): Promise<VendorEntity | null> {
    if (!id) {
      throw new Error('Invalid ID');
    }
    return this.vendorRepository.findVendorById(id);
  }

  async deleteVendor(id: string): Promise<void> {
    if (!id) {
      throw new Error('Invalid ID');
    }
    const vendor = await this.vendorRepository.findVendorById(id);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    await this.vendorRepository.remove(vendor);
  }

  async createVendor(
    createVendorInput: CreateVendorInput,
  ): Promise<VendorEntity> {
    // Check if a vendor with the same email already exists
    const existingVendor = await this.vendorRepository.findOne({
      where: { email: createVendorInput.email },
    });
    if (existingVendor) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createVendorInput.password, 12);
    const vendor = this.vendorRepository.create({
      ...createVendorInput,
      password: hashedPassword,
    });
    return this.vendorRepository.save(vendor);
  }

  async updateVendor(
    id: string,
    updateVendorInput: UpdateVendorInput,
  ): Promise<VendorEntity> {
    // Check if a password is provided in the update input
    if (updateVendorInput.password) {
      if (!updateVendorInput.currentPassword) {
        throw new BadRequestException('Current password is required to change password');
      }

      const vendor = await this.vendorRepository.findOne({ where: { id } });
      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        updateVendorInput.currentPassword,
        vendor.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash the new password before updating
      updateVendorInput.password = bcrypt.hashSync(
        updateVendorInput.password,
        12,
      );
    }

    // Remove currentPassword so TypeORM doesn't attempt to update a non-existent column
    delete updateVendorInput.currentPassword;

    await this.vendorRepository.update(id, updateVendorInput);
    return this.vendorRepository.findOne({ where: { id } });
  }

  async updatePassword(id: string, plainPassword: string): Promise<void> {
    const hashedPassword = bcrypt.hashSync(plainPassword, 12);
    await this.vendorRepository.update(id, { password: hashedPassword });
  }

  async updateVendorProfilePic(
    vendorId: string,
    fileUrl: string,
  ): Promise<VendorEntity> {
    // Find the vendor by ID
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Update the profile_pic_url field
    vendor.profile_pic_url = fileUrl;

    // Save the updated vendor to the database
    return await this.vendorRepository.save(vendor);
  }

  public getVendorByEmail(email: string): Promise<VendorEntity | undefined> {
    return this.vendorRepository.findOne({ where: { email } });
  }

  async createGoogleVendor(data: {
    email: string;
    fname?: string;
    lname?: string;
    profile_pic_url?: string;
  }): Promise<VendorEntity> {
    const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    const vendor = this.vendorRepository.create({
      email: data.email,
      fname: data.fname || 'Vendor',
      lname: data.lname || '',
      busname: `${data.fname || 'Vendor'}'s Services`,
      phone: '',
      city: '',
      location: '',
      profile_pic_url: data.profile_pic_url,
      password: hashedPassword,
    });
    return await this.vendorRepository.save(vendor);
  }

  async findVendorsByOffering(offeringId: string): Promise<VendorEntity[]> {
    return this.vendorRepository.findVendorsByOffering(offeringId);
  }

  async registerPushToken(vendorId: string, pushToken: string): Promise<void> {
    if (!vendorId.trim()) {
      throw new Error('Invalid vendor id');
    }
    if (!pushToken.trim()) {
      throw new Error('Invalid push token');
    }

    await this.vendorRepository.update(vendorId, {
      expoPushToken: pushToken.trim(),
    });
  }
}
